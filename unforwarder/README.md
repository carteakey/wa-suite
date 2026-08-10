# unforwarder

Kill the noise. Memes, forwards, spam links, junk messages — gone.

> Archival and preservation lives in [memento](../memento).

## What's here

| Tool | What it does |
|---|---|
| `whatsapp/delete-shorts.js` | Delete all YouTube Shorts messages |
| `whatsapp/delete-forwarded-media.js` | Delete forwarded images & videos |
| `whatsapp/delete-forwards.js` | Delete forwarded messages sent by me |
| `whatsapp/delete-old.js` | Delete my messages older than a validated age |
| `whatsapp/delete-junk-links.js` | Delete YouTube Shorts + Facebook links (extensible) |
| `unforwarder.py` | Classify images via Ollama: meme → purge, real photo → save |
| `whatsapp/auto-mute.js` | Preview or mute groups matching explicit patterns |
| `whatsapp/leave-groups.js` | Review or leave explicitly matched inactive groups |
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

`delete-forwards.js` covers forwarded text and media. It defaults to forwarding
score `5`, filters with `CHATS`/`GROUPS_ONLY`, de-duplicates message IDs, and
only considers messages where `fromMe` is true. `delete-old.js` requires
`AGE_DAYS` (or `MAX_AGE_DAYS`) and optionally accepts `MESSAGE_TYPES=text,media,link`.
Both commands are dry-run by default and never print message bodies or contact
identifiers.

```bash
node delete-forwards.js
DRY_RUN=false FORWARD_SCORE=5 node delete-forwards.js
AGE_DAYS=365 node delete-old.js
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

The classifier accepts JPG/JPEG/PNG/WebP and short MP4/MOV/WebM/3GP videos
(video classification requires `ffmpeg`). It is dry-run by default, routes
uncertain answers to `review-n-delete/`, and supports a bounded list file:

```bash
python unforwarder.py --source ~/Pictures/WhatsApp/incoming --dry-run
python unforwarder.py --source ~/Pictures/WhatsApp/incoming --list-file media.txt --confidence
DRY_RUN=false python unforwarder.py --source ~/Pictures/WhatsApp/incoming --live
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

## Group controls and scheduling

Group operations require explicit patterns and confirmation for live changes:

```bash
GROUP_PATTERNS="Muted Family,Old Group" node auto-mute.js
DRY_RUN=false GROUP_PATTERNS="Old Group" MUTE_CONFIRM=MUTE_MATCHING_GROUPS node auto-mute.js
GROUP_PATTERNS="Old Group" INACTIVE_DAYS=90 node leave-groups.js
```

The repository-relative `../run.sh weekly` command is the weekly launchd target;
`../run.sh cleanup` remains available for destruction-only runs.
`infra/install-launchd.sh` renders a per-user LaunchAgent with `DRY_RUN=true`,
a lock directory, and aggregate-only logs.

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
| `AGE_DAYS` | *(required by delete-old)* | delete-old.js |
| `MESSAGE_TYPES` | *(all)* | delete-old.js |
| `GROUP_PATTERNS` | *(required by group tools)* | auto-mute.js, leave-groups.js |
| `MUTE_CONFIRM` | *(required live)* | auto-mute.js |
| `LEAVE_CONFIRM` | *(required live)* | leave-groups.js |
| `VIDEO_FFMPEG` | `ffmpeg` | unforwarder.py video mode |
| `VIDEO_FRAME_COUNT` | `4` | unforwarder.py video mode |
