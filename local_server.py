"""Loopback-only static server with read-only access to nearby boat photos."""

import argparse
import json
import mimetypes
import os
import re
import sqlite3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from socket import socket
from socketserver import BaseServer
from typing import TypedDict, cast
from urllib.parse import parse_qs, quote, urlsplit
from equipment_price_db import DEFAULT_DB, read_catalogue, seed_database

PROJECT_ROOT = Path(__file__).resolve().parent
PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


class Photo(TypedDict):
    name: str
    url: str


class PhotoResult(TypedDict):
    photos: list[Photo]
    selected: str | None


def boating_root() -> Path:
    onedrive = os.environ.get("OneDriveCommercial")
    if not onedrive:
        raise FileNotFoundError("OneDriveCommercial is not set; cannot locate local boat photos.")
    root = Path(onedrive) / "Personal" / "Boating"
    if not root.is_dir():
        raise FileNotFoundError("The local Personal\\Boating folder is unavailable.")
    return root.resolve()


def resolve_photo(root: Path, relative: str) -> Path:
    candidate = (root / relative).resolve()
    if not candidate.is_relative_to(root.resolve()) or candidate.suffix.lower() not in PHOTO_EXTENSIONS:
        raise ValueError("Photo path is outside the allowed folder or is not an image.")
    if not candidate.is_file():
        raise FileNotFoundError("Local photo is no longer available.")
    return candidate


def find_photos(root: Path, name: str, size: int, preferences: dict[str, str]) -> PhotoResult:
    if Path(name).name != name or not name.lower().endswith(".pdf") or size < 0:
        raise ValueError("A PDF filename and its byte size are required.")
    matches = [
        path for path in root.rglob("*.pdf")
        if path.name == name and path.stat().st_size == size
        and path.resolve().is_relative_to(root)
    ]
    folders = {path.parent.resolve() for path in matches}
    if not folders:
        raise FileNotFoundError("PDF not found in Personal\\Boating. Use a PDF from that folder to discover nearby photos.")
    if len(folders) != 1:
        raise ValueError("Multiple local folders contain this PDF. Cannot safely choose this boat's photos.")
    folder = folders.pop()
    photos: list[Photo] = []
    for path in sorted(folder.rglob("*")):
        if path.suffix.lower() not in PHOTO_EXTENSIONS or not path.is_file():
            continue
        resolved = path.resolve()
        if not resolved.is_relative_to(folder):
            continue
        relative = resolved.relative_to(root).as_posix()
        photos.append({
            "name": path.relative_to(folder).as_posix(),
            "url": "/api/boat-photo?path=" + quote(relative, safe=""),
        })
    preferred = preferences.get(folder.relative_to(root).as_posix())
    selected = next((p["url"] for p in photos if p["name"] == preferred), None)
    if selected is None:
        selected = next((
            p["url"] for p in photos
            if re.search(r"\b(exterior|hull|underway|sailing|broadside)\b", p["name"], re.I)
            and not re.search(r"\b(interior|cabin|engine|damage)\b", p["name"], re.I)
        ), None)
    return {"photos": photos, "selected": selected}


class LocalHandler(SimpleHTTPRequestHandler):
    def __init__(self, request: socket, client_address: tuple[str, int], server: BaseServer):
        super().__init__(request, client_address, server, directory=str(PROJECT_ROOT))

    def do_GET(self):
        host = urlsplit("//" + self.headers.get("Host", "")).hostname
        if host not in {"127.0.0.1", "localhost", "::1"} or self.headers.get("Sec-Fetch-Site") == "cross-site":
            self.send_error(403, "Local requests only.")
            return
        request = urlsplit(self.path)
        if request.path not in {"/api/boat-photos", "/api/boat-photo", "/api/health", "/api/equipment-prices"}:
            super().do_GET()
            return
        try:
            if request.path == "/api/health":
                self.send_json({"service": "compare-performance-local", "version": 1})
                return
            if request.path == "/api/equipment-prices":
                query = parse_qs(request.query)
                self.send_json(read_catalogue(search=query.get("q", [""])[0]))
                return
            root = boating_root()
            query = parse_qs(request.query)
            if request.path == "/api/boat-photos":
                preferences_path = PROJECT_ROOT / "local-photo-preferences.json"
                raw_preferences: object = json.loads(preferences_path.read_text(encoding="utf-8")) if preferences_path.exists() else {}
                if not isinstance(raw_preferences, dict):
                    raise ValueError("local-photo-preferences.json must map folder names to photo filenames.")
                preferences: dict[str, str] = {}
                for key, value in cast(dict[object, object], raw_preferences).items():
                    if not isinstance(key, str) or not isinstance(value, str):
                        raise ValueError("Photo preferences must contain only string folder names and filenames.")
                    preferences[key] = value
                self.send_json(find_photos(root, query.get("name", [""])[0], int(query.get("size", ["-1"])[0]), preferences))
                return
            photo = resolve_photo(root, query.get("path", [""])[0])
            with photo.open("rb") as stream:
                self.send_response(200)
                self.send_header("Content-Type", mimetypes.guess_type(photo.name)[0] or "application/octet-stream")
                self.send_header("Content-Length", str(photo.stat().st_size))
                self.send_header("Cache-Control", "private, no-cache")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.end_headers()
                self.copyfile(stream, self.wfile)
        except FileNotFoundError as exc:
            self.send_json({"error": str(exc)}, 404)
        except (ValueError, TypeError) as exc:
            self.send_json({"error": str(exc)}, 400)
        except sqlite3.Error as exc:
            self.log_error("Equipment price database failed: %s", exc)
            self.send_json({"error": "Cannot read equipment_prices.sqlite3. Run equipment_price_db.py to initialize the price database."}, 503)
        except OSError as exc:
            self.log_error("Local photo access failed: %s", exc)
            self.send_json({"error": "Cannot read local boat photos. Check folder access and OneDrive availability."}, 500)

    def send_json(self, payload: object, status: int = 200):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--bind", choices=["127.0.0.1", "localhost"], default="127.0.0.1")
    args = parser.parse_args()
    if not DEFAULT_DB.exists():
        seed_database()
    with ThreadingHTTPServer((args.bind, args.port), LocalHandler) as server:
        print(f"Serving comparison and local photos at http://{args.bind}:{args.port}", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
