#!/usr/bin/env node
// Adds the native Android/iOS projects to this React Native CLI app.
//   cd apps/mobile && npm install && npm run native:add
// It asks the official React Native CLI for a fresh plain-JavaScript project (same name + version), copies only its
// android/ and ios/ folders here, and then adds what RentalHub needs (camera, location, photos). Safe to run again.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const RN_VERSION = '0.76.5', CLI_VERSION = '15.0.1', APP_NAME = 'RentalHub';

// ---- pure patchers (unit-tested) ----
function patchBuildGradle(src) {                          // react-native-vision-camera needs Android 8.0+ (API 26)
  return src.replace(/minSdkVersion\s*=\s*\d+/, (m) => (+m.match(/\d+/)[0] < 26 ? 'minSdkVersion = 26' : m));
}
function patchManifest(src) {
  const add = ['<uses-permission android:name="android.permission.CAMERA" />', '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
    '<uses-feature android:name="android.hardware.camera" android:required="false" />'].filter((l) => !src.includes(l.match(/android:name="([^"]+)"/)[1]));
  if (!add.length) return src;
  return src.replace(/(\s*)<application/, `\n    ${add.join('\n    ')}$1<application`);
}
function patchPlist(src) {
  const keys = { NSCameraUsageDescription: 'RentalHub uses the camera to scan the QR tag on your room.', NSLocationWhenInUseUsageDescription: 'RentalHub uses your location to find homes near you and to pin a property.',
    NSPhotoLibraryUsageDescription: 'RentalHub needs your photos so you can add pictures and a video of your property.' };
  const block = Object.entries(keys).filter(([k]) => !src.includes(`<key>${k}</key>`)).map(([k, v]) => `\t<key>${k}</key>\n\t<string>${v}</string>\n`).join('');
  if (!block) return src;
  const i = src.lastIndexOf('</dict>'); return src.slice(0, i) + block + src.slice(i);
}

function patchFile(file, fn) { if (!fs.existsSync(file)) { console.warn('  ! not found, skipped:', file); return; } const a = fs.readFileSync(file, 'utf8'), b = fn(a); if (a !== b) { fs.writeFileSync(file, b); console.log('  patched', path.relative(process.cwd(), file)); } }

function applyPatches(root) {
  patchFile(path.join(root, 'android/build.gradle'), patchBuildGradle);
  patchFile(path.join(root, 'android/app/src/main/AndroidManifest.xml'), patchManifest);
  patchFile(path.join(root, `ios/${APP_NAME}/Info.plist`), patchPlist);
}

function main() {
  const root = path.resolve(__dirname, '..');
  if (!fs.existsSync(path.join(root, 'android')) || !fs.existsSync(path.join(root, 'ios'))) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rh-native-')), dir = path.join(tmp, APP_NAME);
    console.log(`Creating a fresh React Native ${RN_VERSION} (JavaScript) project to take its native folders from...`);
    const r = spawnSync('npx', ['--yes', `@react-native-community/cli@${CLI_VERSION}`, 'init', APP_NAME, '--version', RN_VERSION, '--directory', dir, '--skip-install', '--skip-git-init', '--pm', 'npm'],
      { stdio: 'inherit', shell: process.platform === 'win32' });
    if (r.status !== 0 || !fs.existsSync(path.join(dir, 'android'))) { console.error('\nCould not create the native projects (needs internet). Fix the error above and run again.'); process.exit(1); }
    for (const item of ['android', 'ios', 'Gemfile']) if (fs.existsSync(path.join(dir, item))) fs.cpSync(path.join(dir, item), path.join(root, item), { recursive: true });
    fs.rmSync(tmp, { recursive: true, force: true });
  } else console.log('android/ and ios/ already exist — only re-applying RentalHub settings.');
  applyPatches(root);
  console.log(`
Done. Next:
  Android:  npm run android            (emulator running, or a phone with USB debugging; API on this computer: see src/config.js)
  iOS (Mac): cd ios && bundle install && bundle exec pod install && cd .. && npm run ios
  Real Android phone over USB:  adb reverse tcp:4000 tcp:4000   (then set the Android URL in src/config.js to http://localhost:4000)`);
}

module.exports = { patchBuildGradle, patchManifest, patchPlist, applyPatches };
if (require.main === module) main();
