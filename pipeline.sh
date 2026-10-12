#!/usr/bin/env bash
# pipeline.sh — wa-brahmastra orchestrator
#
# Runs the full WhatsApp hygiene pipeline:
#   destroy:  delete junk links, forwarded media, pattern spam  (unforwarder)
#   preserve: download personal media, sort it with sortling    (memento + sortling)
#
# Usage:
#   ./pipeline.sh                   # full pipeline, dry run
#   ./pipeline.sh destroy           # destruction only, dry run
#   ./pipeline.sh preserve          # preservation only, dry run
#   ./pipeline.sh classify          # sort what's already in INCOMING_DIR, dry run
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
# sortling: one-file decision-model sorter (https://github.com/carteakey/sortling).
# Uses its own config for the model (~/.config/sortling/config.json); SORTLING_BACKEND overrides.
SORTLING_PY="${SORTLING_PY:-$SCRIPT_DIR/sortling.py}"
SORTLING_VERSION="${SORTLING_VERSION:-v0.3.0}"
SORTLING_BACKEND="${SORTLING_BACKEND:-}"

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
    run_classify
  fi
}

# ── Classify (sortling) ───────────────────────────────────────────────────────
# photos/<people|places|food|pets|events|other> = real photos (the old save/), memes/ = forwards
# and good-morning cards to review and bin (the old review-n-delete/), _delete/ = blurry or
# black shots, screenshots/ and docs/ = everything else. Nothing is deleted outright.
ensure_sortling() {
  if [ ! -f "$SORTLING_PY" ]; then
    echo "  fetching sortling $SORTLING_VERSION ..."
    curl -fsSL -o "$SORTLING_PY" "https://github.com/carteakey/sortling/releases/download/$SORTLING_VERSION/sortling.py"
  fi
}

run_classify() {
  [ -d "$INCOMING_DIR" ] || { echo "  $INCOMING_DIR doesn't exist; nothing to sort."; return; }
  ensure_sortling
  local args=(--root "$INCOMING_DIR" --profile photos --no-banner)
  [ -n "$SORTLING_BACKEND" ] && args+=(--backend "$SORTLING_BACKEND")
  [ "$DRY_RUN" = "false" ] && args+=(--apply)

  echo ""
  echo "▸ Sorting $INCOMING_DIR with sortling..."
  python3 "$SORTLING_PY" "${args[@]}"

  if [ "$DRY_RUN" = "false" ]; then
    echo ""
    echo "▸ Moving real photos to $FINAL_DIR ..."
    if [ -d "$INCOMING_DIR/photos" ]; then
      mkdir -p "$FINAL_DIR"
      local n=0
      while IFS= read -r -d '' f; do
        mv -n "$f" "$FINAL_DIR/" && n=$((n + 1))
      done < <(find "$INCOMING_DIR/photos" -type f -print0)
      echo "  Moved $n files. Memes to review are in $INCOMING_DIR/memes/."
    else
      echo "  No photos found."
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
  classify) run_classify ;;
  all)      run_destroy; run_preserve ;;
  *)        echo "Unknown mode: $MODE. Use: all | destroy | preserve | classify"; exit 1 ;;
esac

divider "Done"
