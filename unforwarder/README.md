# unforwarder

Kill the noise. Memes, forwards, spam links, junk messages — gone.

> Archival and preservation lives in [memento](../memento).

## What's here

| Tool | What it does |
|---|---|
| `whatsapp/delete-shorts.js` | Delete all YouTube Shorts messages |
| `whatsapp/delete-forwarded-media.js` | Delete forwarded images & videos |
| `whatsapp/delete-junk-links.js` | Delete YouTube Shorts + Facebook links (extensible) |
| `unforwarder.py` | Legacy: classify images via Ollama. `pipeline.sh` now uses [sortling](https://github.com/carteakey/sortling) instead |
| `screenshot_organizer.py` | Describe screenshots with Ollama, organise with Claude Code |

## Setup

```bash
cd whatsapp && npm install   # Node scripts
pip install -r requirements.txt  # Python scripts
```

On first run of any WhatsApp script: scan the QR code in **WhatsApp → Linked Devices → Link a Device**.
Session saved in `whatsapp/.wwebjs_auth/` — no re-scan on subsequent runs.

---

## whatsapp/delete-shorts.js

Delete all messages containing YouTube Shorts links across every chat.

```bash
cd whatsapp

node delete-shorts.js                                # dry run
DRY_RUN=false node delete-shorts.js                 # nuke
DRY_RUN=false MSG_LIMIT=5000 node delete-shorts.js  # scan deeper history
```

---

## whatsapp/delete-forwarded-media.js

Delete forwarded images and videos. Default threshold is **score ≥ 5** — WhatsApp's
"Forwarded many times" tier. Dry run prints a breakdown by media type before deleting.

```bash
cd whatsapp

node delete-forwarded-media.js                           # dry run, score >= 5
DRY_RUN=false node delete-forwarded-media.js             # nuke score >= 5
DRY_RUN=false FORWARD_SCORE=2 node delete-forwarded-media.js  # wider net
DRY_RUN=false FORWARD_SCORE=1 node delete-forwarded-media.js  # any forwarded media
DRY_RUN=false MSG_LIMIT=5000 node delete-forwarded-media.js   # deeper history
```

---

## unforwarder.py

Sorts a folder of images into `save/` (real photos) and `review-n-delete/` (memes,
forwards, good-morning spam). Requires [Ollama](https://ollama.com) running locally.

```bash
# classify a folder of images
SOURCE_FOLDER=~/Pictures/WhatsApp/incoming python unforwarder.py

# custom model or remote Ollama
OLLAMA_MODEL=llava:13b OLLAMA_SERVER_URL=http://myserver:11434 python unforwarder.py
```

---

## screenshot_organizer.py

Two-step organiser: describe screenshots with Ollama, then move them per
assignments produced by Claude Code.

```bash
# Step 1: describe images → descriptions.json
python screenshot_organizer.py describe --source ~/Desktop/Screenshots

# Step 2: move files per assignments.json
python screenshot_organizer.py execute  --source ~/Desktop/Screenshots
python screenshot_organizer.py execute  --source ~/Desktop/Screenshots --dry-run
```

---

## whatsapp/delete-junk-links.js

Delete spam link messages — YouTube Shorts and Facebook by default. Prints a
per-pattern breakdown in dry run. Add more patterns directly in the `PATTERNS` array.

```bash
cd whatsapp

node delete-junk-links.js                                # dry run
DRY_RUN=false node delete-junk-links.js                 # nuke all patterns
DRY_RUN=false MSG_LIMIT=5000 node delete-junk-links.js  # deeper history
```

---

## Environment variables

| Var | Default | Used by |
|---|---|---|
| `DRY_RUN` | `true` | all whatsapp scripts |
| `MSG_LIMIT` | `2000` | delete-shorts, delete-forwarded-media |
| `FORWARD_SCORE` | `5` | delete-forwarded-media.js |
| `SOURCE_FOLDER` | `.` | unforwarder.py |
| `OLLAMA_SERVER_URL` | `http://localhost:11434` | unforwarder.py, screenshot_organizer.py |
| `OLLAMA_MODEL` | `qwen2.5vl:7b` | unforwarder.py |
| `OLLAMA_VISION_MODEL` | `qwen2.5vl:7b` | screenshot_organizer.py |
