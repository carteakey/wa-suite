# memento

Remember what matters. Save personal photos, archive important chats, keep the signal.

> Cleanup and destruction lives in [unforwarder](../unforwarder).

## What's here

| Tool | What it does |
|---|---|
| `whatsapp/download-media.js` | Download personal photos/videos from WhatsApp to disk |
| `whatsapp/export-chat.js` | Export any chat to markdown or JSON *(coming soon)* |
| `whatsapp/starred-sync.js` | Sync starred messages to a local markdown file |
| `whatsapp/stats.js` | Privacy-safe aggregate message analytics |
| `whatsapp/send-scheduled.js` | Dry-run-first scheduled messages with daily idempotency |

## Setup

```bash
cd whatsapp && npm install
```

On first run: scan the QR code in **WhatsApp → Linked Devices → Link a Device**.
Session saved in `whatsapp/.wwebjs_auth/` — no re-scan on subsequent runs.

---

## whatsapp/download-media.js

Downloads personal photos and videos from WhatsApp chats to `~/Pictures/WhatsApp/YYYY-MM/`
with original timestamps preserved. Skips forwarded media by default (personal only).

Reruns are safe — a `.checkpoint.json` tracks already-downloaded files.

```bash
cd whatsapp

# dry run — see what would be saved
node download-media.js

# download everything personal from all chats
DRY_RUN=false node download-media.js

# specific chats only (partial name match, comma-separated)
DRY_RUN=false CHATS="Family,Mom" node download-media.js

# include forwarded media too (useful to feed into unforwarder.py)
DRY_RUN=false SKIP_FORWARDED=false node download-media.js

# custom output folder
DRY_RUN=false OUTPUT_DIR=~/Backups/WhatsApp node download-media.js

# scan deeper history
DRY_RUN=false MSG_LIMIT=5000 node download-media.js
```

### Pipeline with unforwarder

```bash
# 1. download all media (including forwarded, for classification)
DRY_RUN=false SKIP_FORWARDED=false OUTPUT_DIR=~/Pictures/WhatsApp/incoming node download-media.js

# 2. classify: memes → review-n-delete/, real photos → save/
SOURCE_FOLDER=~/Pictures/WhatsApp/incoming python ../../unforwarder/unforwarder.py
```

### Starred sync and statistics

Both commands default to dry-run. Starred sync writes
`~/Documents/WhatsApp/starred.md` only with `DRY_RUN=false`; entries carry a
stable message marker so reruns do not duplicate them. Statistics emit JSON by
default, aggregate sender/chat identifiers as short hashes, and never print
message bodies or phone numbers.

```bash
node starred-sync.js
DRY_RUN=false OUTPUT_FILE=~/Documents/WhatsApp/starred.md node starred-sync.js
node stats.js
STATS_FORMAT=text node stats.js
```

The weekly LaunchAgent template lives at
`../infra/com.carteakey.wa-suite.weekly.plist.in`; it invokes `../run.sh weekly`
(preserve + cleanup) with a safe dry-run default. Install it with
`../run.sh install-launchd`.

---

## Environment variables

| Var | Default | Used by |
|---|---|---|
| `DRY_RUN` | `true` | all whatsapp scripts |
| `MSG_LIMIT` | `2000` | download-media.js |
| `SKIP_FORWARDED` | `true` | download-media.js |
| `CHATS` | *(all)* | download-media.js |
| `OUTPUT_DIR` | `~/Pictures/WhatsApp` | download-media.js |
| `OUTPUT_FILE` | `~/Documents/WhatsApp/starred.md` | starred-sync.js |
| `STATS_FORMAT` | `json` | stats.js (`json` or `text`) |
| `SEND_ONCE_PER_DAY` | `true` | send-scheduled.js |
| `SCHEDULE_CHECKPOINT` | `./schedule-progress.json` | send-scheduled.js |
