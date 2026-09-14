import socket
import subprocess
import sys
import time
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


def start_server() -> bool:
    try:
        subprocess.Popen(
            [sys.executable, "-m", "http.server", str(PORT)],
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
    if port_is_open(HOST, PORT):
        print(f"Server already running at http://{HOST}:{PORT}/")
        return 0

    print(f"Port {PORT} is not responding. Starting local server...")
    if not start_server():
        print(f"Could not start the local server on port {PORT}.")
        return 1

    for _ in range(20):
        time.sleep(0.5)
        if port_is_open(HOST, PORT):
            print(f"Server started successfully at http://{HOST}:{PORT}/")
            return 0

    print(f"Server start timed out; port {PORT} is still unavailable.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
