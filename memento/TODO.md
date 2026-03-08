# memento — TODO & Roadmap

> **Scope: preservation.** Save what matters — personal photos, important chats, memories.
> Cleanup and deletion lives in [unforwarder](../unforwarder).

## Pipeline Vision

```
WhatsApp chats
    │
    ├─ [ ] download-media.js   — pull images/videos to ~/Pictures/WhatsApp/YYYY-MM/
    │         └─ feed into unforwarder.py to separate real photos from junk
    │
    ├─ [ ] export-chat.js      — dump chat history to markdown/JSON
    │
    ├─ [ ] starred-sync.js     — local copy of all starred messages
    │
    └─ [ ] stats.js            — analytics to understand your chats

~/Pictures/WhatsApp/
    └─ [ ] launchd job         — weekly: download new media, classify, archive
```

---

## WhatsApp Automation (`whatsapp/`)

### Media Backup
- [x] `download-media.js` — download images and videos from specified chats
  - Options: all chats or CHATS="Name1,Name2" filter
  - Skips forwarded media by default (SKIP_FORWARDED=false to include)
  - Saves to OUTPUT_DIR/YYYY-MM/ preserving original timestamps
  - Checkpoint in .checkpoint.json — reruns skip already-downloaded files
  - Feed output into unforwarder.py to classify real photos vs junk

### Chat Archival
- [x] `export-chat.js` — export full chat history
  - Formats: markdown (human-readable) and JSON (machine-readable)
  - Include: sender, timestamp, message body, media filenames
  - Output to `~/Documents/WhatsApp/<chat-name>.md`
  - Useful before leaving a group or archiving an important convo

### Starred Messages
- [ ] `starred-sync.js` — dump all starred messages to a local file
  - Output: `~/Documents/WhatsApp/starred.md`
  - Format: grouped by chat, with sender + timestamp
  - Run periodically — append new, don't duplicate

### Analytics
- [ ] `stats.js` — understand your WhatsApp usage
  - Most active senders, most active groups
  - Media volume per chat (who sends the most photos?)
  - Message count over time
  - Useful for deciding what to keep, mute, or leave

---

## Infrastructure

- [ ] `whatsapp/package.json` with all scripts registered
- [ ] `.env.example` — document all env vars
- [ ] `run.sh` entrypoint:
  ```
  ./run.sh download-media --chat "Family" --since 2024-01-01
  ./run.sh export-chat --chat "Best Friends"
  ./run.sh starred-sync
  ./run.sh stats
  ./run.sh pipeline     # download → classify (via unforwarder) → archive
  ```
- [ ] launchd plist: weekly media backup job
  - `infra/com.memento.weekly.plist`
