#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "▶ Step 1: expo prebuild --clean"
cd "$MOBILE_DIR"
npx expo prebuild --clean

echo "▶ Step 2: CarPlay / Android Auto native setup"
bash "$SCRIPT_DIR/setup-carplay-native.sh"

echo "✅ prebuild.sh complete"
