# memento — TODO & Roadmap

> **Scope: preservation.** Save what matters — personal photos, important chats, memories.
> Cleanup and deletion lives in [unforwarder](../unforwarder).
> Committed backlog planning lives in the WA Suite section of `/Users/kchauhan/repos/TODO_REPORT.md` and Linear; unchecked entries here are speculative only.

## Pipeline Vision

```
WhatsApp chats
    │
    ├─ [x] download-media.js   — pull images/videos to ~/Pictures/WhatsApp/YYYY-MM/
    │         └─ feed into unforwarder.py to separate real photos from junk
    │
    ├─ [x] export-chat.js      — dump chat history to markdown/JSON
    │
    ├─ [x] starred-sync.js     — local copy of all starred messages (CAR-179)
    │
    └─ [x] stats.js            — analytics to understand your chats (CAR-179)

~/Pictures/WhatsApp/
    └─ [x] launchd job         — weekly: download new media, classify, archive (CAR-182)
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
- [x] `starred-sync.js` — dump all starred messages to a local file (CAR-179)
  - Output: `~/Documents/WhatsApp/starred.md`
  - Format: grouped by chat, with sender + timestamp
  - Run periodically — append new, don't duplicate

### Analytics
- [x] `stats.js` — understand your WhatsApp usage (CAR-179)
  - Most active senders, most active groups
  - Media volume per chat (who sends the most photos?)
  - Message count over time
  - Useful for deciding what to keep, mute, or leave

---

## Infrastructure

- [x] `whatsapp/package.json` with all scripts registered (CAR-180)
- [x] `.env.example` — document all env vars (CAR-180)
- [x] `run.sh` entrypoint (CAR-180):
  ```
  ./run.sh download-media --chat "Family" --since 2024-01-01
  ./run.sh export-chat --chat "Best Friends"
  ./run.sh starred-sync
  ./run.sh stats
  ./run.sh pipeline     # download → classify (via unforwarder) → archive
  ```
- [x] launchd plist: weekly media backup job (CAR-182)
  - `infra/com.memento.weekly.plist`
