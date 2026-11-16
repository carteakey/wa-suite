# unforwarder — TODO & Roadmap

> **Scope: destruction.** Kill the noise — memes, forwards, spam, junk links.
> Archival and preservation lives in [memento](../memento).
> Committed backlog planning lives in the WA Suite section of `/Users/kchauhan/repos/TODO_REPORT.md` and Linear; unchecked entries here are speculative only.

## Pipeline Vision

```
WhatsApp (whatsapp-web.js)
    │
    ├─ [✓] delete-shorts.js     — nuke youtube.com/shorts/ messages
    ├─ [x] delete-forwards.js   — nuke heavily forwarded messages (CAR-181)
    ├─ [x] delete-patterns.js   — nuke messages matching custom patterns
    └─ [x] delete-old.js        — nuke your own messages older than N days (CAR-181)

~/Pictures/WhatsApp/incoming/
    │
    └─ [x] unforwarder.py       — Ollama vision: meme vs real photo (CAR-183)
              ├─ memes/forwarded  → review-n-delete/  (then rm)
              └─ real photos      → ../save/           (handoff to memento)
```

---

## WhatsApp Automation (`whatsapp/`)

### Done
- [x] `delete-shorts.js` — delete all YouTube Shorts links (for me only)

### Link / Text Deletion
- [x] `delete-forwards.js` — delete heavily forwarded messages (CAR-181)
  - Filter by `msg.isForwarded` + `msg.forwardingScore` threshold (e.g. >5)
  - Configurable: all chats, specific chats, or groups only
- [x] `delete-junk-links.js` — delete spam link patterns
  - YouTube Shorts (`youtube.com/shorts/`)
  - Facebook (`facebook.com`, `fb.com`, `fb.watch`)
  - Pattern list extensible — add more patterns directly in the file
  - NOTE: Google Drive + Google Photos links are useful — do NOT nuke those
- [x] `delete-patterns.js` — delete messages matching a custom regex list
  - Patterns in `patterns.txt` — one regex per line, `#` for comments
  - Ships with good morning/night, motivational, religious, chain message patterns
- [x] `delete-old.js` — delete your own messages older than N days (CAR-181)
  - Configurable: by chat, by age, by type (text / media / links)

### Forwarded Media
- [x] `delete-forwarded-media.js` — delete forwarded images and videos
  - Match: `msg.isForwarded === true` AND `msg.hasMedia === true`
  - Covers: meme images, reposted reels, random videos from uncle groups
  - Configurable threshold: `FORWARD_SCORE` (default 5 = "forwarded many times")
  - Dry run prints count + breakdown by media type before deleting

### Group Management
- [x] `auto-mute.js` — mute groups matching a name pattern (CAR-182)
- [x] `leave-groups.js` — list groups by activity, leave dead/spammy ones (with confirmation) (CAR-182)

---

## unforwarder.py (image classification)

- [x] Support `.png` and `.webp` in addition to `.jpg` (CAR-183)
- [x] Stricter prompt: distinguish meme vs screenshot of a meme vs real photo with text (CAR-183)
- [x] `--confidence` flag: log model's raw answer alongside yes/no decision (CAR-183)
- [x] Video support: classify short clips (meme reposts vs personal recordings) (CAR-183)
- [x] Batch mode: accept a list file of paths instead of a whole folder (CAR-183)

---

## Infrastructure

- [x] `.env.example` — document all env vars (CAR-180)
- [x] `run.sh` entrypoint (CAR-180):
  ```
  ./run.sh delete-shorts
  ./run.sh delete-forwards --score 5
  ./run.sh delete-patterns
  ./run.sh classify ~/Pictures/WhatsApp/incoming/
  ```
- [x] launchd plist for scheduled weekly cleanup run (CAR-182)
