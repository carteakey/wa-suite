# unforwarder — TODO & Roadmap

> **Scope: destruction.** Kill the noise — memes, forwards, spam, junk links.
> Archival and preservation lives in [memento](../memento).

## Pipeline Vision

```
WhatsApp (whatsapp-web.js)
    │
    ├─ [✓] delete-shorts.js     — nuke youtube.com/shorts/ messages
    ├─ [ ] delete-forwards.js   — nuke heavily forwarded messages
    ├─ [ ] delete-patterns.js   — nuke messages matching custom patterns
    └─ [ ] delete-old.js        — nuke your own messages older than N days

~/Pictures/WhatsApp/incoming/
    │
    └─ [ ] unforwarder.py       — Ollama vision: meme vs real photo
              ├─ memes/forwarded  → review-n-delete/  (then rm)
              └─ real photos      → ../save/           (handoff to memento)
```

---

## WhatsApp Automation (`whatsapp/`)

### Done
- [x] `delete-shorts.js` — delete all YouTube Shorts links (for me only)

### Link / Text Deletion
- [ ] `delete-forwards.js` — delete heavily forwarded messages
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
- [ ] `delete-old.js` — delete your own messages older than N days
  - Configurable: by chat, by age, by type (text / media / links)

### Forwarded Media
- [x] `delete-forwarded-media.js` — delete forwarded images and videos
  - Match: `msg.isForwarded === true` AND `msg.hasMedia === true`
  - Covers: meme images, reposted reels, random videos from uncle groups
  - Configurable threshold: `FORWARD_SCORE` (default 5 = "forwarded many times")
  - Dry run prints count + breakdown by media type before deleting

### Group Management
- [ ] `auto-mute.js` — mute groups matching a name pattern
- [ ] `leave-groups.js` — list groups by activity, leave dead/spammy ones (with confirmation)

---

## unforwarder.py (image classification)

- [ ] Support `.png` and `.webp` in addition to `.jpg`
- [ ] Stricter prompt: distinguish meme vs screenshot of a meme vs real photo with text
- [ ] `--confidence` flag: log model's raw answer alongside yes/no decision
- [ ] Video support: classify short clips (meme reposts vs personal recordings)
- [ ] Batch mode: accept a list file of paths instead of a whole folder

---

## Infrastructure

- [ ] `.env.example` — document all env vars
- [ ] `run.sh` entrypoint:
  ```
  ./run.sh delete-shorts
  ./run.sh delete-forwards --score 5
  ./run.sh delete-patterns
  ./run.sh classify ~/Pictures/WhatsApp/incoming/
  ```
- [ ] launchd plist for scheduled weekly cleanup run
