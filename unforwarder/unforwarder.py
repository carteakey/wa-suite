#!/usr/bin/env python3
"""Classify WhatsApp media with a local Ollama vision model.

The command is deliberately dry-run by default. Images and short videos are
accepted, uncertain model answers go to ``review-n-delete`` (never ``save``),
and checkpoints are written only after a successful live move. Private media
contents are never printed unless the opt-in ``--confidence`` flag is used.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Iterable

try:
    from load_dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional convenience dependency
    load_dotenv = lambda: None

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm", ".3gp"}
SUPPORTED_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS
CHECKPOINT_FILE = ".unforwarder_progress.json"
CLASSIFY_PROMPT = (
    "Classify this WhatsApp media for personal archiving. Return JSON only with "
    "keys forwarded (boolean) and confidence (number from 0 to 1). Set forwarded "
    "true for memes, screenshots of memes, social-media text, good-morning or "
    "chain messages, text-heavy forwards, blurry reposts, or other non-personal "
    "content. Set it false only for a likely personal photo/video. If uncertain, "
    "set forwarded true and confidence below 0.6. Do not include a description."
)


def load_checkpoint(source: Path) -> set[str]:
    checkpoint_path = source / CHECKPOINT_FILE
    if not checkpoint_path.exists():
        return set()
    try:
        with checkpoint_path.open(encoding="utf-8") as handle:
            data = json.load(handle)
        values = data.get("done", []) if isinstance(data, dict) else data
        return {str(value) for value in values if isinstance(value, str)}
    except (OSError, ValueError, TypeError) as exc:
        logger.warning("Ignoring unreadable checkpoint (%s).", exc.__class__.__name__)
        return set()


def save_checkpoint(source: Path, done: set[str]) -> None:
    checkpoint_path = source / CHECKPOINT_FILE
    with checkpoint_path.open("w", encoding="utf-8") as handle:
        json.dump({"done": sorted(done)}, handle, indent=2)
        handle.write("\n")


def relative_key(path: Path, source: Path) -> str:
    try:
        return path.resolve().relative_to(source.resolve()).as_posix()
    except ValueError:
        return path.name


def collect_input_paths(source: Path | None, list_file: Path | None = None) -> list[Path]:
    """Collect supported media deterministically, optionally from a list file.

    List entries must stay under ``source`` when a source is supplied. This
    prevents an accidental list file from moving unrelated personal files.
    """

    if list_file:
        list_path = list_file.expanduser().resolve()
        if not list_path.is_file():
            raise FileNotFoundError(f"List file not found: {list_path}")
        root = source.expanduser().resolve() if source else list_path.parent
        paths: list[Path] = []
        for raw in list_path.read_text(encoding="utf-8").splitlines():
            value = raw.strip()
            if not value or value.startswith("#"):
                continue
            candidate = Path(value).expanduser()
            if not candidate.is_absolute():
                candidate = root / candidate
            candidate = candidate.resolve()
            try:
                candidate.relative_to(root)
            except ValueError:
                logger.warning("Skipping list entry outside source root.")
                continue
            if candidate.is_file() and candidate.suffix.lower() in SUPPORTED_EXTENSIONS:
                paths.append(candidate)
        return sorted(set(paths), key=lambda item: item.as_posix().lower())

    if source is None:
        raise ValueError("SOURCE_FOLDER or --source is required")
    root = source.expanduser().resolve()
    if not root.is_dir():
        raise NotADirectoryError(f"Not a directory: {root}")
    return sorted(
        (path for path in root.iterdir() if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS),
        key=lambda item: item.name.lower(),
    )


def _confidence(value: Any) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if 0 <= parsed <= 1:
        return parsed
    return None


def parse_model_answer(raw: str) -> dict[str, Any]:
    """Normalize JSON or legacy yes/no model output.

    ``forwarded`` is ``None`` for uncertainty. Callers must route uncertainty
    to review rather than treating it as personal media.
    """

    text = str(raw or "").strip()
    forwarded: bool | None = None
    confidence: float | None = None
    try:
        payload = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        payload = None
    if isinstance(payload, dict):
        value = payload.get("forwarded", payload.get("is_forwarded", payload.get("decision")))
        if isinstance(value, bool):
            forwarded = value
        elif isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {"yes", "true", "forwarded", "review"}:
                forwarded = True
            elif lowered in {"no", "false", "personal", "save"}:
                forwarded = False
        confidence = _confidence(payload.get("confidence"))
    if forwarded is None:
        lowered = text.lower()
        if re.search(r"\b(yes|true|forwarded|review)\b", lowered):
            forwarded = True
        elif re.search(r"\b(no|false|personal|save)\b", lowered):
            forwarded = False
    if confidence is None:
        match = re.search(r"confidence\s*[:=]\s*(0(?:\.\d+)?|1(?:\.0+)?)", text, re.I)
        if match:
            confidence = _confidence(match.group(1))
    uncertain = forwarded is None or (confidence is not None and confidence < 0.6)
    return {
        "forwarded": forwarded,
        "confidence": confidence,
        "uncertain": uncertain,
        "raw": text,
    }


def unique_destination(folder: Path, filename: str) -> Path:
    destination = folder / filename
    if not destination.exists():
        return destination
    stem, suffix = destination.stem, destination.suffix
    counter = 1
    while True:
        candidate = folder / f"{stem}-{counter}{suffix}"
        if not candidate.exists():
            return candidate
        counter += 1


def extract_video_frames(video_path: Path, frame_count: int = 4) -> tuple[tempfile.TemporaryDirectory, list[Path]]:
    """Extract bounded representative frames; fail clearly without ffmpeg."""

    ffmpeg = os.environ.get("VIDEO_FFMPEG", "ffmpeg")
    if shutil.which(ffmpeg) is None and not Path(ffmpeg).is_file():
        raise RuntimeError("video classification requires ffmpeg (set VIDEO_FFMPEG to its path)")
    if frame_count <= 0 or frame_count > 12:
        raise ValueError("VIDEO_FRAME_COUNT must be between 1 and 12")
    temp_dir = tempfile.TemporaryDirectory(prefix="unforwarder-video-")
    output = Path(temp_dir.name) / "frame-%02d.jpg"
    command = [
        ffmpeg,
        "-v", "error",
        "-i", str(video_path),
        "-vf", f"thumbnail=n={frame_count}",
        "-frames:v", str(frame_count),
        "-y", str(output),
    ]
    result = subprocess.run(command, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        temp_dir.cleanup()
        raise RuntimeError("ffmpeg could not extract video frames")
    frames = sorted(Path(temp_dir.name).glob("frame-*.jpg"))
    if not frames:
        temp_dir.cleanup()
        raise RuntimeError("ffmpeg produced no video frames")
    return temp_dir, frames


def classify_path(path: Path, client: Any, model: str) -> str:
    temp_dir = None
    image_paths = [path]
    if path.suffix.lower() in VIDEO_EXTENSIONS:
        temp_dir, image_paths = extract_video_frames(path, int(os.environ.get("VIDEO_FRAME_COUNT", "4")))
    try:
        response = client.chat(
            model=model,
            messages=[{
                "role": "user",
                "content": CLASSIFY_PROMPT,
                "images": [str(image) for image in image_paths],
            }],
        )
        return str(response.message.content)
    finally:
        if temp_dir:
            temp_dir.cleanup()


def process_images(
    source_folder: str | Path | None,
    list_file: str | Path | None = None,
    *,
    dry_run: bool = True,
    show_confidence: bool = False,
    client: Any = None,
    model: str | None = None,
) -> dict[str, int]:
    source = Path(source_folder).expanduser().resolve() if source_folder else None
    list_path = Path(list_file).expanduser().resolve() if list_file else None
    paths = collect_input_paths(source, list_path)
    root = source or (list_path.parent if list_path else None)
    if root is None:
        raise ValueError("SOURCE_FOLDER or --source is required")
    save_folder = root / "save"
    review_folder = root / "review-n-delete"
    done = load_checkpoint(root)
    todo = [path for path in paths if relative_key(path, root) not in done]
    result = {"found": len(paths), "todo": len(todo), "saved": 0, "review": 0, "uncertain": 0, "failed": 0}
    if not todo:
        logger.info("No unprocessed media found (%d discovered).", len(paths))
        return result

    if client is None:
        try:
            from ollama import Client
        except ImportError as exc:  # pragma: no cover - environment dependent
            raise RuntimeError("install the unforwarder requirements to classify media") from exc
        client = Client(host=os.environ.get("OLLAMA_SERVER_URL", "http://localhost:11434"))
    model = model or os.environ.get("OLLAMA_MODEL", "qwen2.5vl:7b")
    if not dry_run:
        save_folder.mkdir(exist_ok=True)
        review_folder.mkdir(exist_ok=True)

    for path in todo:
        key = relative_key(path, root)
        try:
            parsed = parse_model_answer(classify_path(path, client, model))
            if parsed["uncertain"]:
                result["uncertain"] += 1
            target_folder = review_folder if parsed["uncertain"] or parsed["forwarded"] is not False else save_folder
            if parsed["forwarded"] is False and not parsed["uncertain"]:
                result["saved"] += 1
            else:
                result["review"] += 1
            if show_confidence:
                logger.info("classification confidence=%s forwarded=%s raw=%r", parsed["confidence"], parsed["forwarded"], parsed["raw"])
            if not dry_run:
                destination = unique_destination(target_folder, path.name)
                shutil.move(str(path), str(destination))
                done.add(key)
                save_checkpoint(root, done)
        except Exception as exc:  # retry the item on the next run
            result["failed"] += 1
            logger.warning("classification item failed (%s).", exc.__class__.__name__)

    logger.info(
        "Classification complete: found=%d todo=%d saved=%d review=%d uncertain=%d failed=%d%s",
        result["found"], result["todo"], result["saved"], result["review"], result["uncertain"], result["failed"],
        " (dry run)" if dry_run else "",
    )
    return result


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Classify WhatsApp images/videos with Ollama")
    parser.add_argument("--source", default=os.environ.get("SOURCE_FOLDER"), help="Source folder (or set SOURCE_FOLDER)")
    parser.add_argument("--list-file", type=Path, help="File containing one media path per line")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", dest="dry_run", action="store_true", help="Classify without moving files (default)")
    mode.add_argument("--live", dest="dry_run", action="store_false", help="Move files and update the checkpoint")
    parser.set_defaults(dry_run=os.environ.get("DRY_RUN", "true").lower() != "false")
    parser.add_argument("--confidence", action="store_true", help="Log raw model answers and normalized confidence")
    parser.add_argument("--model", default=os.environ.get("OLLAMA_MODEL", "qwen2.5vl:7b"))
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    process_images(args.source, args.list_file, dry_run=args.dry_run, show_confidence=args.confidence, model=args.model)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
