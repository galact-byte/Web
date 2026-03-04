"""Wait until the local service is reachable, then open browser once."""

from __future__ import annotations

import socket
import sys
import time
import webbrowser


def _can_connect(port: int, timeout: float = 0.4) -> bool:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.settimeout(timeout)
        return sock.connect_ex(("127.0.0.1", port)) == 0
    finally:
        sock.close()


def main() -> int:
    try:
        port = int(sys.argv[1])
    except (IndexError, ValueError):
        return 0

    try:
        wait_seconds = int(sys.argv[2]) if len(sys.argv) > 2 else 30
    except ValueError:
        wait_seconds = 30

    wait_seconds = max(wait_seconds, 1)
    url = f"http://127.0.0.1:{port}"
    deadline = time.time() + wait_seconds

    while time.time() < deadline:
        if _can_connect(port):
            webbrowser.open(url)
            return 0
        time.sleep(0.5)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
