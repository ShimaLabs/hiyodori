#!/usr/bin/env python3
"""Convert nhk_2016_pronunciations_index.json to a TSV for Hiyodori import."""

import csv
import json
import sys

AUDIO_BASE = (
    "https://raw.githubusercontent.com/"
    "Ajatt-Tools/nhk_2016_pronunciations_index_mp3/refs/heads/main/media/"
)

def main(input_path: str, output_path: str) -> None:
    print(f"Loading {input_path}…", flush=True)
    with open(input_path, encoding="utf-8") as f:
        data = json.load(f)

    files: dict = data["files"]
    headwords: dict = data["headwords"]

    # Build a reverse map: filename -> [written forms]
    # (a file can appear under multiple headwords)
    file_to_written: dict[str, list[str]] = {}
    for written, filenames in headwords.items():
        for filename in filenames:
            file_to_written.setdefault(filename, []).append(written)

    rows = []
    for filename, meta in files.items():
        reading = meta.get("kana_reading", "").strip()
        pitch_str = meta.get("pitch_number", "").strip()
        pitch = int(pitch_str) if pitch_str.lstrip("-").isdigit() else ""
        audio_url = AUDIO_BASE + filename

        written_forms = file_to_written.get(filename, [])
        if written_forms:
            # Emit one row per written form that references this file
            for written in written_forms:
                rows.append((reading, audio_url, written, pitch))
        else:
            # File exists in the index but no headword points to it — include without written
            rows.append((reading, audio_url, "", pitch))

    print(f"Writing {len(rows)} rows to {output_path}…", flush=True)
    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter="\t")
        writer.writerow(["reading", "audio_url", "written", "pitch"])
        for reading, audio_url, written, pitch in rows:
            writer.writerow([reading, audio_url, written, pitch])

    print("Done.", flush=True)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <input.json> <output.tsv>")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
