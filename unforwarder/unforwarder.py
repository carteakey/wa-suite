import json
import logging
import os
import shutil
from pathlib import Path

from ollama import Client
from load_dotenv import load_dotenv
from tqdm import tqdm

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

CLASSIFY_PROMPT = (
    "Is this image one of: social media texts, screenshots, good morning messages, "
    "super blurry images, memes, or any other forwarded content? Just answer yes or no."
)

CHECKPOINT_FILE = "unforwarder_progress.json"


def load_checkpoint(source: Path) -> set:
    checkpoint_path = source / CHECKPOINT_FILE
    if checkpoint_path.exists():
        with checkpoint_path.open() as f:
            done = json.load(f)
        logger.info(f"Resuming – {len(done)} files already processed.")
        return set(done)
    return set()


def save_checkpoint(source: Path, done: set) -> None:
    with (source / CHECKPOINT_FILE).open("w") as f:
        json.dump(list(done), f)


def process_images(source_folder: str) -> None:
    source = Path(source_folder)
    save_folder = source / "save"
    review_folder = source / "review-n-delete"
    save_folder.mkdir(exist_ok=True)
    review_folder.mkdir(exist_ok=True)

    done = load_checkpoint(source)

    all_files = [f for f in os.listdir(source) if f.lower().endswith((".jpg", ".jpeg"))]
    todo = [f for f in all_files if f not in done]

    if not todo:
        logger.info("All images already processed.")
        return

    logger.info(f"{len(todo)} to process ({len(all_files) - len(todo)} already done).")

    client = Client(host=os.environ.get("OLLAMA_SERVER_URL", "http://localhost:11434"))
    model = os.environ.get("OLLAMA_MODEL", "qwen2.5vl:7b")

    for filename in tqdm(todo, desc="Processing"):
        file_path = source / filename
        if not file_path.exists():
            logger.warning(f"{filename} no longer in source – skipping.")
            done.add(filename)
            continue

        try:
            response = client.chat(
                model=model,
                messages=[{
                    "role": "user",
                    "content": CLASSIFY_PROMPT,
                    "images": [str(file_path)],
                }],
            )
        except Exception as e:
            logger.error(f"LLM failed for {filename}: {e}")
            continue  # don't checkpoint – retry next run

        answer = response.message.content.strip().lower()
        logger.info(f"{filename}: {answer}")

        destination = save_folder / filename if answer.startswith("no") else review_folder / filename

        try:
            shutil.move(str(file_path), str(destination))
        except Exception as e:
            logger.error(f"Failed to move {filename}: {e}")
            continue

        done.add(filename)
        save_checkpoint(source, done)

    logger.info("Processing complete.")


if __name__ == "__main__":
    process_images(os.environ.get("SOURCE_FOLDER"))
