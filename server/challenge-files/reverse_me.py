#!/usr/bin/env python3
# CipherArena - Reverse Me
# Enter the licence key. Only the right one is accepted.
import sys

KEY = [19,55,66,153,90]
TARGET = [80,125,71,246,81,132,146,164,34,68,167,81,136,5,138,201,118,151,115,238,250]


def scramble(text):
    out = []
    for i, ch in enumerate(text.encode()):
        out.append(((ch ^ KEY[i % len(KEY)]) + i * 7) & 0xFF)
    return out


def main():
    guess = input("Licence key: ").strip()
    if scramble(guess) == TARGET:
        print("Access granted. Submit your key as the flag.")
    else:
        print("Access denied.")
        sys.exit(1)


if __name__ == "__main__":
    main()
