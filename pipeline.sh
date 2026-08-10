#!/usr/bin/env bash
# pipeline.sh — wa-brahmastra orchestrator
#
# Runs the full WhatsApp hygiene pipeline:
#   destroy:  delete junk links, forwarded media, pattern spam  (unforwarder)
#   preserve: download personal media, classify with Ollama     (memento)
#
# Usage:
#   ./pipeline.sh                   # full pipeline, dry run
#   ./pipeline.sh destroy           # destruction only, dry run
#   ./pipeline.sh preserve          # preservation only, dry run
#   DRY_RUN=false ./pipeline.sh     # full pipeline, live
#
# Env vars passed through to child scripts — see each script for full reference.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNFORWARDER="$SCRIPT_DIR/unforwarder"
MEMENTO="$SCRIPT_DIR/memento"

DRY_RUN="${DRY_RUN:-true}"
INCOMING_DIR="${INCOMING_DIR:-$HOME/Pictures/WhatsApp/incoming}"
FINAL_DIR="${FINAL_DIR:-$HOME/Pictures/WhatsApp}"
OLLAMA_MODEL="${OLLAMA_MODEL:-qwen2.5vl:7b}"
OLLAMA_SERVER_URL="${OLLAMA_SERVER_URL:-http://localhost:11434}"

MODE="${1:-all}"

divider() { echo ""; echo "══════════════════════════════════════════"; echo "  $1"; echo "══════════════════════════════════════════"; echo ""; }

# ── Destroy ───────────────────────────────────────────────────────────────────
run_destroy() {
  divider "SHIVA — destroying the noise"

  local wa="$UNFORWARDER/whatsapp"

  echo "▸ Junk links (Shorts, Facebook)..."
  DRY_RUN=$DRY_RUN node "$wa/delete-junk-links.js"

  echo ""
  echo "▸ Forwarded media (forwardingScore >= ${FORWARD_SCORE:-5})..."
  DRY_RUN=$DRY_RUN FORWARD_SCORE="${FORWARD_SCORE:-5}" node "$wa/delete-forwarded-media.js"

  echo ""
  echo "▸ Pattern spam (good morning, chains, etc.)..."
  DRY_RUN=$DRY_RUN node "$wa/delete-patterns.js"
}

# ── Preserve ──────────────────────────────────────────────────────────────────
run_preserve() {
  divider "VISHNU — preserving the signal"

  local wa="$MEMENTO/whatsapp"

  echo "▸ Downloading media to $INCOMING_DIR ..."
  DRY_RUN=$DRY_RUN \
    SKIP_FORWARDED="${SKIP_FORWARDED:-false}" \
    OUTPUT_DIR="$INCOMING_DIR" \
    node "$wa/download-media.js"

  if [ "$DRY_RUN" = "false" ] && [ -d "$INCOMING_DIR" ]; then
    echo ""
    echo "▸ Classifying with Ollama ($OLLAMA_MODEL)..."
    DRY_RUN="$DRY_RUN" \
      SOURCE_FOLDER="$INCOMING_DIR" \
      OLLAMA_SERVER_URL="$OLLAMA_SERVER_URL" \
      OLLAMA_MODEL="$OLLAMA_MODEL" \
      python "$UNFORWARDER/unforwarder.py"

    echo ""
    echo "▸ Moving real photos to $FINAL_DIR ..."
    if [ -d "$INCOMING_DIR/save" ] && [ "$(ls -A "$INCOMING_DIR/save" 2>/dev/null)" ]; then
      mkdir -p "$FINAL_DIR"
      mv "$INCOMING_DIR/save/"* "$FINAL_DIR/"
      echo "  Moved $(ls "$FINAL_DIR" | wc -l | tr -d ' ') files."
    else
      echo "  Nothing in save/."
    fi
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────
echo ""
echo "  wa-brahmastra pipeline"
echo "  DRY_RUN=$DRY_RUN  MODE=$MODE"
if [ "$DRY_RUN" = "true" ]; then
  echo "  (set DRY_RUN=false to run live)"
fi

case "$MODE" in
  destroy)  run_destroy ;;
  preserve) run_preserve ;;
  all)      run_destroy; run_preserve ;;
  *)        echo "Unknown mode: $MODE. Use: all | destroy | preserve"; exit 1 ;;
esac

divider "Done"
