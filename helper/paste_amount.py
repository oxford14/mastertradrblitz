#!/usr/bin/env python3
"""Paste progression stake digits into the focused Invest field (Windows)."""

from __future__ import annotations

import argparse
import re
import sys
import time


def extract_digits(amount: str) -> str:
    return re.sub(r"\D", "", amount or "")


def paste_amount(amount: str, *, select_all: bool = True) -> tuple[bool, str]:
    digits = extract_digits(amount)
    if not digits:
        return False, "No digits in amount"

    try:
        import pyautogui
        import pyperclip
    except ImportError:
        return False, "Missing dependency — run: pip install -r helper/requirements.txt"

    backup: str | None = None
    try:
        try:
            backup = pyperclip.paste()
        except pyperclip.PyperclipException:
            backup = None

        pyperclip.copy(digits)
        time.sleep(0.08)

        pyautogui.FAILSAFE = True
        pyautogui.PAUSE = 0.02

        if select_all:
            pyautogui.hotkey("ctrl", "a")
            time.sleep(0.06)

        pyautogui.hotkey("ctrl", "v")
        time.sleep(0.1)

        return True, f"pasted {digits}"
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)
    finally:
        if backup is not None:
            try:
                pyperclip.copy(backup)
            except Exception:
                pass


def type_amount(amount: str) -> tuple[bool, str]:
    """Fallback: type digits one-by-one with pyautogui."""
    digits = extract_digits(amount)
    if not digits:
        return False, "No digits in amount"

    try:
        import pyautogui
    except ImportError:
        return False, "Missing dependency — run: pip install -r helper/requirements.txt"

    try:
        pyautogui.FAILSAFE = True
        pyautogui.hotkey("ctrl", "a")
        time.sleep(0.06)
        pyautogui.typewrite(digits, interval=0.04)
        time.sleep(0.08)
        return True, f"typed {digits}"
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)


def main() -> int:
    parser = argparse.ArgumentParser(description="Paste stake into focused Invest field")
    parser.add_argument("amount", help="Stake digits, e.g. 488")
    parser.add_argument(
        "--mode",
        choices=("paste", "type"),
        default="paste",
        help="paste = clipboard Ctrl+V (default), type = pyautogui.typewrite",
    )
    parser.add_argument(
        "--wait-ms",
        type=int,
        default=0,
        help="Delay before paste (field should already be focused)",
    )
    args = parser.parse_args()

    if args.wait_ms > 0:
        time.sleep(args.wait_ms / 1000.0)

    if args.mode == "type":
        ok, message = type_amount(args.amount)
    else:
        ok, message = paste_amount(args.amount)

    print(message, file=sys.stderr if not ok else sys.stdout)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
