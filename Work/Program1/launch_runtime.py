"""Run a subprocess and colorize streamed logs in the current console."""

from __future__ import annotations

import ctypes
import subprocess
import sys
import threading


RESET = "\x1b[0m"
COLORS = {
    "error": "\x1b[91m",
    "warn": "\x1b[93m",
    "info": "\x1b[96m",
    "ok": "\x1b[92m",
    "debug": "\x1b[90m",
}


def _enable_virtual_terminal() -> None:
    if sys.platform != "win32":
        return
    kernel32 = ctypes.windll.kernel32
    handle = kernel32.GetStdHandle(-11)
    if handle == 0:
        return
    mode = ctypes.c_uint()
    if kernel32.GetConsoleMode(handle, ctypes.byref(mode)) == 0:
        return
    kernel32.SetConsoleMode(handle, mode.value | 0x0004)


def _color_for(line: str) -> str:
    text = line.upper()
    if any(key in text for key in ("ERROR:", " ERROR", "[ERROR]", "CRITICAL", "TRACEBACK", "EXCEPTION")):
        return COLORS["error"]
    if any(key in text for key in ("WARNING:", " WARNING", "[WARN]", " WARN ", "DEPRECATED")):
        return COLORS["warn"]
    if any(
        key in text
        for key in (
            "SUCCESSFULLY INSTALLED",
            "REQUIREMENT ALREADY SATISFIED",
            "INSTALLED ",
            "READY IN",
        )
    ):
        return COLORS["ok"]
    if any(
        key in text
        for key in (
            "COLLECTING ",
            "DOWNLOADING ",
            "USING CACHED",
            "INSTALLING ",
            "PREPARING METADATA",
            "BUILDING WHEEL",
            "GET /",
            "POST /",
            "PUT /",
            "DELETE /",
        )
    ):
        return COLORS["info"]
    if any(key in text for key in ("[ OK ]", "SUCCESS", "READY", "STARTED")):
        return COLORS["ok"]
    if any(key in text for key in ("INFO:", " INFO", "[INFO]", "UVICORN RUNNING", "APPLICATION STARTUP COMPLETE")):
        return COLORS["info"]
    if any(key in text for key in ("DEBUG", "WATCHFILES", "STATRELOAD")):
        return COLORS["debug"]
    return ""


def _pump(source, sink) -> None:
    carry_color = ""
    carry_budget = 0
    try:
        for raw in iter(source.readline, ""):
            color = _color_for(raw)
            if not color and carry_color and raw.strip():
                color = carry_color
                carry_budget -= 1
                if carry_budget <= 0:
                    carry_color = ""
            elif color == COLORS["warn"]:
                carry_color = COLORS["warn"]
                carry_budget = 2
            elif color == COLORS["error"]:
                carry_color = COLORS["error"]
                carry_budget = 3
            else:
                carry_color = ""
                carry_budget = 0
            sink.write(f"{color}{raw}{RESET}" if color else raw)
            sink.flush()
    finally:
        source.close()


def main() -> int:
    _enable_virtual_terminal()
    command = sys.argv[1:]
    if not command:
        print("launch_runtime.py requires a command to run.", file=sys.stderr)
        return 2

    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )

    threads = [
        threading.Thread(target=_pump, args=(process.stdout, sys.stdout), daemon=True),
        threading.Thread(target=_pump, args=(process.stderr, sys.stderr), daemon=True),
    ]
    for thread in threads:
        thread.start()

    try:
        return process.wait()
    except KeyboardInterrupt:
        process.terminate()
        return process.wait()


if __name__ == "__main__":
    raise SystemExit(main())
