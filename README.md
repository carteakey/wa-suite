# unforwarder

Kill the noise. Memes, forwards, spam links, junk messages — gone.

> Archival and preservation lives in [memento](../memento).

## What's here

| Tool | What it does |
|---|---|
| `whatsapp/delete-shorts.js` | Delete all YouTube Shorts messages from every chat |
| `unforwarder.py` | Classify images (Ollama vision): meme/forwarded → purge, real photo → save |
| `screenshot_organizer.py` | Describe screenshots with Ollama, organise with Claude Code |

## Pipeline

```
WhatsApp → delete-shorts  → YouTube Shorts nuked
         → delete-forwards → forwarded spam nuked
         → delete-patterns → custom junk patterns nuked

~/Pictures/WhatsApp/incoming/
         → unforwarder.py  → memes to review-n-delete/, real photos to save/
```

See [TODO.md](TODO.md) for the full roadmap.

---

## whatsapp/delete-shorts.js

```bash
cd whatsapp && npm install

node delete-shorts.js                              # dry run
DRY_RUN=false node delete-shorts.js               # nuke
MSG_LIMIT=5000 DRY_RUN=false node delete-shorts.js
```

On first run: scan the QR code in WhatsApp → Linked Devices → Link a Device.
Session saved in `.wwebjs_auth/` — no re-scan on subsequent runs.

---

## unforwarder.py

Sorts a folder of images into `save/` (real photos) and `review-n-delete/` (memes, forwards, spam).
Requires [Ollama](https://ollama.com) running locally with a vision model.

```bash
pip install -r requirements.txt
SOURCE_FOLDER=~/Pictures/WhatsApp/incoming python unforwarder.py
```

---

## Environment variables

| Var | Default | Used by |
|---|---|---|
| `DRY_RUN` | `true` | delete-shorts.js |
| `MSG_LIMIT` | `2000` | delete-shorts.js |
| `SOURCE_FOLDER` | `.` | unforwarder.py |
| `OLLAMA_SERVER_URL` | `http://localhost:11434` | unforwarder.py |
| `OLLAMA_MODEL` | `qwen2.5vl:7b` | unforwarder.py |
