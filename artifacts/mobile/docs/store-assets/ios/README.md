# FahrtDoc – iOS App Store Assets

All assets are ready for upload to App Store Connect.

## iPhone 6.7" Screenshots (required)

| File | Size | Screen |
|------|------|--------|
| `screenshot-01-home.png` | 1290×2796 px | Home screen – stats, quick start, recent trips |
| `screenshot-02-active.png` | 1290×2796 px | Active GPS trip recording |
| `screenshot-03-history.png` | 1290×2796 px | Trip history with month summary |
| `screenshot-04-export.png` | 1290×2796 px | PDF & CSV export screen |

## iPad Pro 12.9" Screenshots (optional but recommended)

| File | Size | Screen |
|------|------|--------|
| `ipad-screenshot-01-home.png` | 2048×2732 px | Home – two-column layout |
| `ipad-screenshot-02-active.png` | 2048×2732 px | Active trip with route preview |
| `ipad-screenshot-03-export.png` | 2048×2732 px | Export with full PDF preview |

## Feature Banner

| File | Size | Use |
|------|------|-----|
| `feature-banner.png` | 1024×500 px | Promotional / marketing banner |

## How to upload to App Store Connect

1. Open [App Store Connect](https://appstoreconnect.apple.com)
2. Select **FahrtDoc** → **App Store** → **iOS App** → edit version
3. Under **iPhone 6.7" Display** upload the four `screenshot-0*.png` files
4. Under **iPad Pro (12.9-inch, 6th gen) Display** upload the three `ipad-*.png` files (optional but boosts discoverability on iPad searches)
5. The `feature-banner.png` can be used for Apple Search Ads or external marketing

## How to regenerate

```bash
cd artifacts/mobile/docs/store-assets/ios
node generate-ios-assets.js
```

Requires ImageMagick (`magick` command) – already available in the Replit environment.

## Design notes

- All screenshots use the dark-mode FahrtDoc design (consistent with the Android assets)
- iPhone screenshots scale from the 1080×1920 Android base via SVG `transform="scale()"` to fill 1290×2796
- iOS chrome (Dynamic Island, home indicator) is drawn in native 1290×2796 coordinates on top
- iPad screenshots use a two-column layout to make full use of the larger canvas
- Colors, typography, and mock data match the Android screenshots for brand consistency
