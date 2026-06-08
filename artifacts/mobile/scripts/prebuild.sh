#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$MOBILE_DIR"

echo "▶ Step 1: expo prebuild --clean"
# Use pnpm exec to resolve expo from workspace node_modules
pnpm exec expo prebuild --clean

echo "▶ Step 2: CarPlay / Android Auto native setup"
bash "$SCRIPT_DIR/setup-carplay-native.sh"

echo "✅ prebuild.sh complete"
