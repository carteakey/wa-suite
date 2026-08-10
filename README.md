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

# preservation only
DRY_RUN=false ./pipeline.sh preserve

# command entrypoint (works from any directory; mutating commands stay dry-run)
./run.sh --help
./run.sh starred-sync
./run.sh classify --source ~/Pictures/WhatsApp/incoming
```

### What it does

**Destroy (unforwarder)**
1. Delete junk links — YouTube Shorts, Facebook
2. Delete forwarded media — images/videos with forwardingScore ≥ 5
3. Delete pattern spam — good morning, chain messages, motivational filler

**Preserve (memento)**
1. Download personal media → `~/Pictures/WhatsApp/incoming/`
2. Classify with Ollama vision — memes to `review-n-delete/`, real photos to `save/`
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
| `OLLAMA_MODEL` | `qwen3-vl:8b` | Vision model for classification |
| `OLLAMA_SERVER_URL` | `http://localhost:11434` | Ollama instance |

See `unforwarder/` and `memento/` READMEs for per-script options.

## Privacy and safety

The repository never stores WhatsApp sessions, chat exports, contacts, profile
records, images, Office temporary files, or matching-person data. These paths
are ignored locally; only sanitized fixtures may be committed. Destructive
commands and media classification default to dry-run, and cleanup scripts only
mutate messages sent by the authenticated account after explicit opt-in.
