#!/usr/bin/env bash
# Render and install the weekly dry-run cleanup LaunchAgent.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="$ROOT_DIR/infra/com.carteakey.wa-suite.weekly.plist.in"
TARGET_DIR="$HOME/Library/LaunchAgents"
TARGET="$TARGET_DIR/com.carteakey.wa-suite.weekly.plist"

mkdir -p "$TARGET_DIR" "$HOME/Library/Logs"
sed -e "s|__WA_SUITE_ROOT__|$ROOT_DIR|g" -e "s|__HOME__|$HOME|g" "$TEMPLATE" > "$TARGET"
echo "Rendered $TARGET"
echo "Load with: launchctl bootstrap gui/\$(id -u) $TARGET"
echo "The job is intentionally DRY_RUN=true; review output before opting into live preservation/cleanup."
