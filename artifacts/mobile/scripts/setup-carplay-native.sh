#!/usr/bin/env bash
# setup-carplay-native.sh
# Run this AFTER `expo prebuild` to wire CarPlay (iOS) and Android Auto (Android)
# native code into the generated ios/ and android/ directories.
#
# Usage (from artifacts/mobile/):
#   bash scripts/setup-carplay-native.sh
#
# Requirements:
#   • expo prebuild must have run first (ios/ and android/ dirs must exist)
#   • Ruby + xcodeproj gem (installed automatically with CocoaPods)
#   • Android: android/ directory from expo prebuild

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
NATIVE_DIR="$MOBILE_DIR/native"

IOS_DIR="$MOBILE_DIR/ios"
ANDROID_DIR="$MOBILE_DIR/android"
PACKAGE_PATH="com/fahrtdoc/app"

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

ok()   { echo "  ✅ $*"; }
warn() { echo "  ⚠️  $*"; }
step() { echo; echo "▶ $*"; }

check_dirs() {
  if [[ ! -d "$IOS_DIR" && ! -d "$ANDROID_DIR" ]]; then
    echo "❌  Neither ios/ nor android/ found."
    echo "    Run 'expo prebuild' first, then re-run this script."
    exit 1
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# iOS — CarPlay
# ─────────────────────────────────────────────────────────────────────────────

setup_ios() {
  step "iOS — CarPlay"

  if [[ ! -d "$IOS_DIR" ]]; then
    warn "ios/ directory not found — skipping iOS setup."
    return
  fi

  # Locate the app target directory (contains AppDelegate.swift)
  APP_TARGET_DIR=$(find "$IOS_DIR" -name "AppDelegate.swift" -not -path "*/Pods/*" \
    | head -1 | xargs dirname 2>/dev/null || true)

  if [[ -z "$APP_TARGET_DIR" ]]; then
    warn "Could not locate AppDelegate.swift — skipping iOS file copy."
    warn "Manually copy native/ios/*.swift and native/ios/*.m into your Xcode target."
    return
  fi

  # Copy Swift + ObjC bridge files
  cp "$NATIVE_DIR/ios/CarPlaySceneDelegate.swift"  "$APP_TARGET_DIR/"
  cp "$NATIVE_DIR/ios/FahrtDocCarPlayModule.swift"  "$APP_TARGET_DIR/"
  cp "$NATIVE_DIR/ios/FahrtDocCarPlayModule.m"      "$APP_TARGET_DIR/"
  ok "Copied Swift + ObjC bridge files to $APP_TARGET_DIR"

  # Add files to Xcode project using xcodeproj gem (ships with CocoaPods)
  XCODEPROJ=$(find "$IOS_DIR" -maxdepth 1 -name "*.xcodeproj" | head -1)
  if [[ -z "$XCODEPROJ" ]]; then
    warn "Could not find .xcodeproj — add the files manually in Xcode."
    return
  fi

  TARGET_NAME=$(basename "$XCODEPROJ" .xcodeproj)

  ruby - "$XCODEPROJ" "$TARGET_NAME" \
    "$APP_TARGET_DIR/CarPlaySceneDelegate.swift" \
    "$APP_TARGET_DIR/FahrtDocCarPlayModule.swift" \
    "$APP_TARGET_DIR/FahrtDocCarPlayModule.m" \
    <<'RUBY'
require 'xcodeproj'

proj_path, target_name, *file_paths = ARGV
project = Xcodeproj::Project.open(proj_path)
target  = project.targets.find { |t| t.name == target_name }

abort "Target '#{target_name}' not found in #{proj_path}" unless target

group = project.main_group.find_subpath(target_name, true)

file_paths.each do |path|
  next if group.files.any? { |f| f.real_path.to_s == path }
  file_ref = group.new_reference(path)
  target.source_build_phase.add_file_reference(file_ref)
  puts "  ✅ Added #{File.basename(path)} to Xcode project"
end

project.save
RUBY

  ok "Xcode project updated."
}

# ─────────────────────────────────────────────────────────────────────────────
# Android — Android Auto
# ─────────────────────────────────────────────────────────────────────────────

setup_android() {
  step "Android — Android Auto"

  if [[ ! -d "$ANDROID_DIR" ]]; then
    warn "android/ directory not found — skipping Android setup."
    return
  fi

  JAVA_DIR="$ANDROID_DIR/app/src/main/java/$PACKAGE_PATH"
  RES_XML_DIR="$ANDROID_DIR/app/src/main/res/xml"
  MANIFEST="$ANDROID_DIR/app/src/main/AndroidManifest.xml"
  BUILD_GRADLE="$ANDROID_DIR/app/build.gradle"

  # 1. Kotlin source files
  mkdir -p "$JAVA_DIR" "$RES_XML_DIR"
  cp "$NATIVE_DIR/android/FahrtDocCarAppService.kt"  "$JAVA_DIR/"
  cp "$NATIVE_DIR/android/FahrtDocCarSession.kt"     "$JAVA_DIR/"
  cp "$NATIVE_DIR/android/FahrtDocCarScreen.kt"      "$JAVA_DIR/"
  cp "$NATIVE_DIR/android/FahrtDocCarPlayModule.kt"  "$JAVA_DIR/"
  cp "$NATIVE_DIR/android/FahrtDocCarPlayPackage.kt" "$JAVA_DIR/"
  ok "Copied Kotlin sources to $JAVA_DIR"

  # 2. automotive_app_desc.xml
  cp "$NATIVE_DIR/android/automotive_app_desc.xml" "$RES_XML_DIR/"
  ok "Copied automotive_app_desc.xml to $RES_XML_DIR"

  # 3. Patch AndroidManifest.xml — inject service + meta-data before </application>
  if grep -q "FahrtDocCarAppService" "$MANIFEST"; then
    ok "AndroidManifest.xml already patched — skipping."
  else
    INJECTION='        <service\n            android:name=".FahrtDocCarAppService"\n            android:exported="true"\n            android:label="FahrtDoc">\n            <intent-filter>\n                <action android:name="androidx.car.app.CarAppService" />\n                <category android:name="androidx.car.app.category.DRIVINGAPP" />\n            </intent-filter>\n            <meta-data\n                android:name="distractionOptimized"\n                android:value="true"/>\n        </service>\n\n        <meta-data\n            android:name="com.google.android.gms.car.application"\n            android:resource="@xml/automotive_app_desc" />\n'
    # Insert before </application>
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|</application>|${INJECTION}\n    </application>|" "$MANIFEST"
    else
      sed -i "s|</application>|${INJECTION}\n    </application>|" "$MANIFEST"
    fi
    ok "AndroidManifest.xml patched with CarAppService and meta-data."
  fi

  # 4. Patch build.gradle — add Car App library dependency
  if grep -q "androidx.car.app:app" "$BUILD_GRADLE"; then
    ok "build.gradle already has Car App dependency — skipping."
  else
    CAR_DEP='    implementation "androidx.car.app:app:1.4.0"'
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "/dependencies {/a\\
${CAR_DEP}" "$BUILD_GRADLE"
    else
      sed -i "/dependencies {/a\\${CAR_DEP}" "$BUILD_GRADLE"
    fi
    ok "build.gradle patched with androidx.car.app:app:1.4.0"
  fi

  # 5. Patch MainApplication.kt — register FahrtDocCarPlayPackage
  MAIN_APP=$(find "$ANDROID_DIR" -name "MainApplication.kt" | head -1)
  if [[ -z "$MAIN_APP" ]]; then
    warn "MainApplication.kt not found — skipping package registration."
    warn "Manually add 'FahrtDocCarPlayPackage()' to your ReactPackage list."
    return
  fi

  if grep -q "FahrtDocCarPlayPackage" "$MAIN_APP"; then
    ok "MainApplication.kt already registers FahrtDocCarPlayPackage — skipping."
  else
    # Insert package after the opening of getPackages() / packageList line
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' 's/PackageList(this).packages/PackageList(this).packages.also { it.add(FahrtDocCarPlayPackage()) }/' "$MAIN_APP"
    else
      sed -i 's/PackageList(this).packages/PackageList(this).packages.also { it.add(FahrtDocCarPlayPackage()) }/' "$MAIN_APP"
    fi
    ok "MainApplication.kt patched to register FahrtDocCarPlayPackage."
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────────────────────────────────────

echo "╔══════════════════════════════════════════════╗"
echo "║  FahrtDoc — CarPlay / Android Auto Setup     ║"
echo "╚══════════════════════════════════════════════╝"

check_dirs
setup_ios
setup_android

echo
echo "╔══════════════════════════════════════════════╗"
echo "║  Setup complete!                              ║"
echo "║  See docs/carplay-native-setup.md for next   ║"
echo "║  steps (entitlement, simulators, testing).   ║"
echo "╚══════════════════════════════════════════════╝"
