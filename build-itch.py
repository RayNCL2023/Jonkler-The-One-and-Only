"""Builds ../jonkler-itch.zip for uploading to itch.io.

Don't use PowerShell's Compress-Archive for this: on Windows PowerShell 5.1 it writes
paths like "js\\game.js", which itch's Linux servers treat as a single filename,
so every script 404s and the game shows a black screen.
"""
import os
import zipfile

SRC = os.path.dirname(os.path.abspath(__file__))
DST = os.path.join(os.path.dirname(SRC), "jonkler-itch.zip")
SKIP = {"build-itch.py"}

with zipfile.ZipFile(DST, "w", zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(SRC):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for f in files:
            if f.startswith(".") or f in SKIP:
                continue
            full = os.path.join(root, f)
            z.write(full, os.path.relpath(full, SRC).replace("\\", "/"))

print(f"Wrote {DST}")
