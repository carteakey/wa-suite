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
- [ ] `delete-junk-links.js` — delete spam link patterns
  - YouTube Shorts (`youtube.com/shorts/`) ← already in delete-shorts.js
  - Google Drive shares (`drive.google.com/file`, `drive.google.com/open`)
  - Google Photos shares (`photos.app.goo.gl`, `photos.google.com/share`)
  - WhatsApp forward aggregators (whatsapp.com/channel, broadcast lists)
  - Pattern list extensible via config file
- [ ] `delete-patterns.js` — delete messages matching a custom regex list
  - Good morning/night messages, news spam, emoji chains, motivational quotes
  - Pattern list in a config file (regex per line)
- [ ] `delete-old.js` — delete your own messages older than N days
  - Configurable: by chat, by age, by type (text / media / links)

### Forwarded Media
- [ ] `delete-forwarded-media.js` — delete forwarded images and videos
  - Match: `msg.isForwarded === true` AND `msg.hasMedia === true`
  - Covers: meme images, reposted reels, random videos from uncle groups
  - Configurable threshold: `msg.forwardingScore > N` to only kill the most viral
  - DRY_RUN mode prints count + chat breakdown before deleting

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
