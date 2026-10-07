# RentalHub mobile app — React Native CLI (bare), JavaScript

One app for Tenant, Agent and Owner. **No Expo, no TypeScript.**

## What you need once
- Node 18+ and JDK 17
- Android: Android Studio with an emulator (or a phone with USB debugging)
- iOS (Mac only): Xcode and CocoaPods
- The API running: from the repo root `npm run api` (port 4000)

## First run
```bash
cd apps/mobile
npm install
npm run native:add      # creates the android/ and ios/ folders from the official React Native CLI (needs internet) and adds
                        # camera, location and photo permissions. Safe to run again.
npm run android         # or, on a Mac:  cd ios && bundle install && bundle exec pod install && cd .. && npm run ios
```
`npm run start` runs only the Metro bundler.

## Pointing the app at your API
Edit `src/config.js`.
- Android emulator → `http://10.0.2.2:4000` (already the default)
- iOS simulator → `http://localhost:4000` (default)
- Real Android phone on USB → run `adb reverse tcp:4000 tcp:4000` and use `http://localhost:4000`
- Real phone on Wi-Fi → your computer's address, e.g. `http://192.168.1.20:4000`
- Release build → set `PROD_URL` (must be https)

## Demo logins (dev API shows the OTP on screen)
Tenant 9876543210 · Owner 9425011111 · Agent 9770012345

## Checks
`npm run check` — fails if Expo or TypeScript sneaks in, an import is missing, or a package is not declared.
`npm run sync:theme` — copies the shared colour tokens (packages/theme) into `src/shared/tokens.js`.

## Native libraries used
react-native-vision-camera (QR scanner) · react-native-image-picker (photos/video) · @react-native-community/geolocation · react-native-keychain (secure login storage) · react-native-svg + react-native-qrcode-svg · react-navigation.

## Known limits
- This code has not been run on a device or emulator yet (the build machine had no Android/iOS tooling). Expect to fix small first-run issues — send me the error text.
- React Native 0.76 turns the New Architecture on by default. If a library gives trouble, set `newArchEnabled=false` in `android/gradle.properties` (and `RCT_NEW_ARCH_ENABLED=0 bundle exec pod install` on iOS).
- Screens use emoji as icons for now; replace with an icon set (e.g. react-native-vector-icons) when the design is final.
