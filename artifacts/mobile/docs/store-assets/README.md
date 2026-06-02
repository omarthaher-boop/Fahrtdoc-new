# FahrtDoc – Google Play Store Assets

All assets are ready for upload to Google Play Console.

| File | Size | Source | Purpose |
|------|------|--------|---------|
| `feature-graphic.png` | 1024×500 px | Designed | Feature Graphic (required for store listing) |
| `screenshot-01-home.png` | 1080×1920 px | Running app (web) | Home Screen with trip stats & quick start |
| `screenshot-02-active.png` | 1080×1920 px | Running app (web) | Active GPS trip recording |
| `screenshot-03-history.png` | 1080×1920 px | Running app (web) | Trip history list with month summary |
| `screenshot-04-export.png` | 1080×1920 px | Running app (web) | PDF & CSV export screen |

Screenshots are captured from the actual running Expo web app at `/store-preview?screen=<name>`.
The feature graphic is a designed brand asset (standard practice for store listings).

## How to upload

1. Open [Google Play Console](https://play.google.com/console)
2. Select **FahrtDoc** → **Store presence** → **Main store listing**
3. Upload `feature-graphic.png` under **Feature graphic**
4. Upload all four screenshots under **Phone screenshots**

## How to regenerate screenshots

Screenshots are taken from the live Expo app via the `/store-preview` route.

### Prerequisites
- API server running: `pnpm --filter @workspace/api-server run dev`
- Expo running: `pnpm --filter @workspace/mobile run dev`

### Capture workflow

```bash
# 1. The route is already in the app at artifacts/mobile/app/store-preview.tsx
# 2. Take screenshots from the running Expo web preview at:
#    /store-preview?screen=home
#    /store-preview?screen=active
#    /store-preview?screen=history
#    /store-preview?screen=export
# 3. Scale to 1080x1920 with ImageMagick:
magick "input.jpg" -resize "1080x1920^" -gravity center -extent 1080x1920 -background "#F7F9FC" "output.png"
```

### Regenerate the feature graphic

```bash
cd artifacts/mobile/docs/store-assets
node generate-assets.js   # regenerates feature-graphic.png only
```

## Replacing with device screenshots (recommended before launch)

For the best quality, replace the web screenshots with native device captures:

1. Run the app on an Android emulator (API 33+, Pixel 7 profile)
2. Navigate to each screen in the running app
3. Use Android Studio's screenshot tool or `adb shell screencap`
4. Scale to 1080×1920 px and save here
