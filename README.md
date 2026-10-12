# wa-suite

One pipeline to clean your WhatsApp — destroy the noise, preserve the signal.

```
wa-suite/
├── unforwarder/   — destroy the noise
├── memento/       — preserve the signal
└── pipeline.sh   — orchestrate both
```

## Pipeline

```bash
# dry run — see what would happen
./pipeline.sh

# go live
DRY_RUN=false ./pipeline.sh

# destruction only
DRY_RUN=false ./pipeline.sh destroy

# just sort what's already in INCOMING_DIR
./pipeline.sh classify

# preservation only
DRY_RUN=false ./pipeline.sh preserve
```

### What it does

**Destroy (unforwarder)**
1. Delete junk links — YouTube Shorts, Facebook
2. Delete forwarded media — images/videos with forwardingScore ≥ 5
3. Delete pattern spam — good morning, chain messages, motivational filler

**Preserve (memento)**
1. Download personal media → `~/Pictures/WhatsApp/incoming/`
2. Sort with [sortling](https://github.com/carteakey/sortling) (`--profile photos`): real photos to
   `photos/<people|places|food|pets|events|other>`, memes and forwards to `memes/` to review,
   blurry or black shots to `_delete/`. Nothing is deleted outright, and every run has an undo.
3. Move real photos to `~/Pictures/WhatsApp/`

---

## Environment variables

| Var | Default | What |
|---|---|---|
| `DRY_RUN` | `true` | Safe mode — no changes |
| `FORWARD_SCORE` | `5` | Forwarding threshold ("forwarded many times") |
| `INCOMING_DIR` | `~/Pictures/WhatsApp/incoming` | Download landing zone |
| `FINAL_DIR` | `~/Pictures/WhatsApp` | Real photos destination |
| `SKIP_FORWARDED` | `false` | Download forwarded media too (for classification) |
| `SORTLING_PY` | `./sortling.py` | sortling script; fetched from the release if missing |
| `SORTLING_VERSION` | `v0.3.0` | Release to fetch |
| `SORTLING_BACKEND` | (sortling's default) | Model backend from sortling's config (`sortling.py --setup`) |

See `unforwarder/` and `memento/` READMEs for per-script options.
