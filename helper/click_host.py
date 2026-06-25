#!/usr/bin/env python3
"""DEPRECATED: Use helper/vb/MtbClickHelper (VB.NET) instead."""

from __future__ import annotations

import json
import struct
import sys


def read_message() -> dict | None:
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    length = struct.unpack("@I", raw_length)[0]
    payload = sys.stdin.buffer.read(length)
    return json.loads(payload.decode("utf-8"))


def write_message(message: dict) -> None:
    encoded = json.dumps(message).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("@I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def handle(message: dict) -> dict:
    action = message.get("action")
    if action == "ping":
        return {"ok": True, "message": "pong"}

    if action == "click":
        try:
            import pyautogui
        except ImportError:
            return {
                "ok": False,
                "message": "Install pyautogui: pip install pyautogui",
            }

        x = int(message.get("x", 0))
        y = int(message.get("y", 0))
        pyautogui.FAILSAFE = True
        pyautogui.click(x=x, y=y)
        return {"ok": True, "message": f"clicked {x}, {y}"}

    return {"ok": False, "message": f"Unknown action: {action}"}


def main() -> None:
    while True:
        message = read_message()
        if message is None:
            break
        write_message(handle(message))


if __name__ == "__main__":
    main()
