#!/usr/bin/env python3
"""
screenshot_organizer.py - Two-command screenshot organiser

  Step 1 – describe
    Runs every image through a local Ollama vision model and writes
    descriptions.json to the source folder. Hand that file to Claude Code.

  Step 2 – execute
    Reads assignments.json produced by Claude Code and moves/renames files
    into the organised/ folder tree.

Usage:
  python screenshot_organizer.py describe --source ~/Desktop/Screenshots
  python screenshot_organizer.py execute  --source ~/Desktop/Screenshots
  python screenshot_organizer.py execute  --source ~/Desktop/Screenshots --dry-run
"""

import argparse
import json
import logging
import os
import re
import shutil
from pathlib import Path

from ollama import Client
from load_dotenv import load_dotenv
from tqdm import tqdm

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}

DESCRIBE_PROMPT = (
    "Describe this screenshot in 2-3 sentences. Include: "
    "(1) which application or website is shown, "
    "(2) the main content or action visible, "
    "(3) any important text, error messages, or data present. "
    "Be specific and factual. Do not speculate."
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def collect_images(source: Path) -> list[Path]:
    return sorted(p for p in source.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS)


def safe_filename(name: str, suffix: str) -> str:
    name = re.sub(r"[^a-z0-9\-]", "", name.lower())
    name = re.sub(r"-{2,}", "-", name).strip("-")
    return f"{name}{suffix}"


def unique_dest(folder: Path, filename: str) -> Path:
    dest = folder / filename
    stem, suffix = dest.stem, dest.suffix
    counter = 1
    while dest.exists():
        dest = folder / f"{stem}-{counter}{suffix}"
        counter += 1
    return dest


# ---------------------------------------------------------------------------
# Step 1 – describe
# ---------------------------------------------------------------------------

def cmd_describe(args):
    source: Path = args.source.expanduser().resolve()
    if not source.is_dir():
        raise NotADirectoryError(f"Not a directory: {source}")

    images = collect_images(source)
    if not images:
        logger.info("No images found.")
        return

    checkpoint = source / "descriptions.json"
    descriptions: dict = {}
    if checkpoint.exists():
        with checkpoint.open() as f:
            descriptions = json.load(f)
        logger.info(f"Resuming – {len(descriptions)} already described.")

    todo = [p for p in images if p.name not in descriptions]
    if not todo:
        logger.info(f"All {len(images)} images already described. See {checkpoint}")
        return

    client = Client(host=args.ollama_url, timeout=args.timeout)
    model = args.ollama_model

    for img_path in tqdm(todo, desc="Describing"):
        try:
            response = client.chat(
                model=model,
                messages=[{
                    "role": "user",
                    "content": DESCRIBE_PROMPT,
                    "images": [str(img_path)],
                }],
            )
            descriptions[img_path.name] = response.message.content.strip()
        except Exception as e:
            logger.warning(f"Failed for {img_path.name}: {e} — will retry on next run.")
            continue  # don't checkpoint, so it retries next run

        with checkpoint.open("w") as f:
            json.dump(descriptions, f, indent=2)

    logger.info(f"Done. Share {checkpoint} with Claude Code, then run the execute step.")


# ---------------------------------------------------------------------------
# Step 2 – execute
# ---------------------------------------------------------------------------

def cmd_execute(args):
    source: Path = args.source.expanduser().resolve()
    assignments_path: Path = args.assignments or (source / "assignments.json")

    if not assignments_path.exists():
        raise FileNotFoundError(f"assignments.json not found at {assignments_path}")

    with assignments_path.open() as f:
        assignments: dict = json.load(f)

    images = collect_images(source)
    organised_root = source / "organised"
    moved = skipped = 0

    for img_path in images:
        entry = assignments.get(img_path.name)
        if not entry:
            logger.warning(f"No assignment for {img_path.name} – skipping.")
            skipped += 1
            continue

        folder_name = entry.get("folder", "misc")
        new_name = safe_filename(entry.get("new_name", img_path.stem), img_path.suffix.lower())
        dest_folder = organised_root / folder_name
        dest_path = unique_dest(dest_folder, new_name)

        if args.dry_run:
            print(f"  {img_path.name}")
            print(f"    → organised/{folder_name}/{dest_path.name}")
        else:
            dest_folder.mkdir(parents=True, exist_ok=True)
            shutil.move(str(img_path), str(dest_path))

        moved += 1

    action = "Would move" if args.dry_run else "Moved"
    logger.info(f"{action} {moved} files, skipped {skipped}.")
    if not args.dry_run:
        logger.info(f"Files are in: {organised_root}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Screenshot organiser via Ollama + Claude Code")
    sub = parser.add_subparsers(dest="command", required=True)

    def add_source(p):
        p.add_argument(
            "--source", type=Path,
            default=Path(os.environ.get("SCREENSHOTS_FOLDER", ".")),
            help="Folder of screenshots (default: $SCREENSHOTS_FOLDER)",
        )

    d = sub.add_parser("describe", help="Describe images with Ollama → descriptions.json")
    add_source(d)
    d.add_argument("--ollama-url", default=os.environ.get("OLLAMA_SERVER_URL", "http://localhost:11434"))
    d.add_argument("--ollama-model", default=os.environ.get("OLLAMA_VISION_MODEL", "qwen2.5vl:7b"))
    d.add_argument("--timeout", type=float, default=120.0, help="Seconds to wait per image (default: 120)")
    d.set_defaults(func=cmd_describe)

    e = sub.add_parser("execute", help="Move files per assignments.json from Claude Code")
    add_source(e)
    e.add_argument("--assignments", type=Path, default=None)
    e.add_argument("--dry-run", action="store_true")
    e.set_defaults(func=cmd_execute)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
