#!/usr/bin/env bash
# Repository-relative command entrypoint. Destructive commands remain dry-run
# unless DRY_RUN=false is explicitly supplied.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'EOF'
Usage: ./run.sh <command> [args]

Pipeline: pipeline | destroy | preserve | cleanup | weekly
Memento:  download-media | export-chat | starred-sync | stats | send-scheduled
Unforwarder: delete-shorts | delete-forwarded-media | delete-forwards | delete-old
             delete-junk-links | delete-patterns | auto-mute | leave-groups | classify
Operations: install-launchd
Verification: test

All mutating commands default to DRY_RUN=true. Set DRY_RUN=false only after
reviewing a dry-run result and any command-specific confirmation requirement.
EOF
}

run_locked() {
  local lock_dir="$1"
  shift
  if ! mkdir "$lock_dir" 2>/dev/null; then
    echo "run already active; exiting without changes"
    return 0
  fi
  set +e
  "$@"
  local status=$?
  set -e
  rmdir "$lock_dir" 2>/dev/null || true
  return "$status"
}

command="${1:-help}"
if [[ $# -gt 0 ]]; then shift; fi

case "$command" in
  help|-h|--help)
    usage
    ;;
  pipeline)
    exec "$ROOT_DIR/pipeline.sh" "${1:-all}"
    ;;
  destroy|preserve)
    exec "$ROOT_DIR/pipeline.sh" "$command"
    ;;
  cleanup)
    run_locked "${TMPDIR:-/tmp}/wa-suite-cleanup.lock" env DRY_RUN="${DRY_RUN:-true}" "$ROOT_DIR/pipeline.sh" destroy
    ;;
  weekly)
    run_locked "${TMPDIR:-/tmp}/wa-suite-weekly.lock" env DRY_RUN="${DRY_RUN:-true}" "$ROOT_DIR/pipeline.sh" all
    ;;
  download-media|export-chat|starred-sync|stats|send-scheduled)
    exec node "$ROOT_DIR/memento/whatsapp/$command.js" "$@"
    ;;
  delete-shorts|delete-forwarded-media|delete-forwards|delete-old|delete-junk-links|delete-patterns|auto-mute|leave-groups)
    exec node "$ROOT_DIR/unforwarder/whatsapp/$command.js" "$@"
    ;;
  classify)
    exec python3 "$ROOT_DIR/unforwarder/unforwarder.py" "$@"
    ;;
  install-launchd)
    exec "$ROOT_DIR/infra/install-launchd.sh" "$@"
    ;;
  test)
    node --test "$ROOT_DIR"/test/*.test.js
    python3 -m unittest discover -s "$ROOT_DIR/test" -p 'test_*.py'
    ;;
  *)
    echo "Unknown command: $command" >&2
    usage >&2
    exit 2
    ;;
esac
