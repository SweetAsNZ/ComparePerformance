import argparse
import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

PORT = 8000
HOST = "127.0.0.1"
PROJECT_ROOT = Path(__file__).resolve().parent


def port_is_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=1):
            return True
    except OSError:
        return False


def start_server(host: str, port: int) -> bool:
    try:
        cmd = [sys.executable, "-m", "http.server", str(port), "--bind", host]
        subprocess.Popen(
            cmd,
            cwd=str(PROJECT_ROOT),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == "win32" else 0,
        )
        return True
    except Exception as exc:
        print(f"Failed to start server: {exc}")
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Start a local web server for the Catamaran Performance Comparator.")
    parser.add_argument("--host", default=HOST, help=f"Bind address (default: {HOST})")
    parser.add_argument("--port", type=int, default=PORT, help=f"Port to serve on (default: {PORT})")
    parser.add_argument("--open-browser", action="store_true", help="Open the local site in the default browser once it starts")
    args = parser.parse_args()

    url = f"http://{args.host}:{args.port}/"

    if port_is_open(args.host, args.port):
        print(f"Server already running at {url}")
        if args.open_browser:
            webbrowser.open(url)
        return 0

    print(f"Port {args.port} is not responding. Starting local server on {url}...")
    if not start_server(args.host, args.port):
        print(f"Could not start the local server on port {args.port}.")
        return 1

    for _ in range(30):
        time.sleep(0.5)
        if port_is_open(args.host, args.port):
            print(f"Server started successfully at {url}")
            if args.open_browser:
                webbrowser.open(url)
            return 0

    print(f"Server start timed out; port {args.port} is still unavailable.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
