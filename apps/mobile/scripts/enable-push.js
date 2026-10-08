#!/usr/bin/env node
// Turns push notifications on for the mobile app.   cd apps/mobile && npm run push:enable
// Before running: create a Firebase project, add an Android app (package com.rentalhub) and an iOS app (bundle id from Xcode),
// download google-services.json → android/app/  and  GoogleService-Info.plist → ios/RentalHub/   (see SETUP.md, Part 7).
// Safe to run again. Anything it cannot patch automatically is listed at the end.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const APP = 'RentalHub';

// ---- pure patchers (unit-tested). Each is idempotent and leaves the file alone when its marker is already there. ----
function patchProjectGradle(src) {
  if (src.includes('com.google.gms:google-services')) return src;
  return src.replace(/(buildscript\s*\{[\s\S]*?dependencies\s*\{)/, "$1\n        classpath('com.google.gms:google-services:4.4.2')");
}
function patchAppGradle(src) {
  if (src.includes('com.google.gms.google-services')) return src;
  return src.trimEnd() + '\n\napply plugin: "com.google.gms.google-services"\n';
}
function patchManifestPush(src) {
  const line = '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />';
  return src.includes('POST_NOTIFICATIONS') ? src : src.replace(/(\s*)<application/, `\n    ${line}$1<application`);
}
function patchPodfile(src) {
  if (src.includes('RNFirebaseAsStaticFramework')) return src;
  return src.replace(/(prepare_react_native_project!)/, "$1\n\n# Firebase (push notifications) needs static frameworks\n$RNFirebaseAsStaticFramework = true\nuse_frameworks! :linkage => :static");
}
function patchAppDelegate(src) {
  if (src.includes('FIRApp configure') || src.includes('FirebaseApp.configure')) return src;
  if (/\.swift/.test('') ) return src;
  let out = src.replace(/(#import "AppDelegate.h"\n)/, '$1#import <Firebase.h>\n');
  out = out.replace(/(didFinishLaunchingWithOptions:\(NSDictionary \*\)launchOptions\s*\{\s*\n)/, '$1  [FIRApp configure];\n');
  return out;
}
function setPushFlag(src, on = true) { return src.replace(/export const PUSH_ENABLED = (true|false);/, `export const PUSH_ENABLED = ${on};`); }

function patchFile(file, fn, marker) {
  if (!fs.existsSync(file)) { console.warn('  ! not found:', path.relative(process.cwd(), file)); return false; }
  const a = fs.readFileSync(file, 'utf8'), b = fn(a); if (a !== b) fs.writeFileSync(file, b);
  const ok = b.includes(marker); console.log(`  ${ok ? '✓' : '! could not patch automatically'} ${path.relative(process.cwd(), file)}`); return ok;
}

function main() {
  const root = path.resolve(__dirname, '..'), todo = [];
  const hasAndroid = fs.existsSync(path.join(root, 'android')), hasIos = fs.existsSync(path.join(root, 'ios'));
  if (!hasAndroid && !hasIos) { console.error('Run `npm run native:add` first (the android/ and ios/ folders do not exist yet).'); process.exit(1); }
  const gj = path.join(root, 'android/app/google-services.json'), gp = path.join(root, `ios/${APP}/GoogleService-Info.plist`);
  if (hasAndroid && !fs.existsSync(gj)) { console.error('Missing android/app/google-services.json (download it from your Firebase project: Project settings → Your apps → Android).'); process.exit(1); }
  if (hasIos && !fs.existsSync(gp)) todo.push('iOS: download GoogleService-Info.plist from Firebase and add it to ios/RentalHub in Xcode (drag it in, tick "Copy items"), then run this command again.');

  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const deps = Object.entries(pkg.optionalNative ?? {}).map(([k, v]) => `${k}@${v}`);
  console.log('Installing Firebase packages:', deps.join(' '));
  const r = spawnSync('npm', ['install', '--save-exact=false', ...deps], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) { console.error('npm install failed (needs internet).'); process.exit(1); }

  console.log('Patching native files:');
  if (hasAndroid) {
    patchFile(path.join(root, 'android/build.gradle'), patchProjectGradle, 'com.google.gms:google-services') || todo.push('Android: add classpath("com.google.gms:google-services:4.4.2") to buildscript dependencies in android/build.gradle');
    patchFile(path.join(root, 'android/app/build.gradle'), patchAppGradle, 'com.google.gms.google-services') || todo.push('Android: add apply plugin: "com.google.gms.google-services" at the end of android/app/build.gradle');
    patchFile(path.join(root, 'android/app/src/main/AndroidManifest.xml'), patchManifestPush, 'POST_NOTIFICATIONS');
  }
  if (hasIos) {
    patchFile(path.join(root, 'ios/Podfile'), patchPodfile, 'RNFirebaseAsStaticFramework') || todo.push('iOS: see https://rnfirebase.io/#generating-ios-credentials for the Podfile changes');
    if (fs.existsSync(gp)) patchFile(path.join(root, `ios/${APP}/AppDelegate.mm`), patchAppDelegate, 'FIRApp configure') || todo.push('iOS: add `#import <Firebase.h>` and `[FIRApp configure];` at the start of didFinishLaunchingWithOptions in ios/RentalHub/AppDelegate (.mm or .swift)');
    todo.push('iOS: in Xcode → target RentalHub → Signing & Capabilities → add "Push Notifications" and "Background Modes" (tick "Remote notifications"). In Firebase → Project settings → Cloud Messaging, upload your Apple APNs key.', 'iOS: cd ios && bundle exec pod install');
  }
  patchFile(path.join(root, 'src/config.js'), (s) => setPushFlag(s, true), 'PUSH_ENABLED = true');
  console.log(`\nPush is ON in the app. Rebuild it:  npm run android   (and npm run ios)\nServer side: put the Firebase service-account JSON into FCM_SERVICE_ACCOUNT_JSON (SETUP.md, Part 7).`);
  if (todo.length) console.log('\nStill to do by hand:\n - ' + todo.join('\n - '));
}

module.exports = { patchProjectGradle, patchAppGradle, patchManifestPush, patchPodfile, patchAppDelegate, setPushFlag };
if (require.main === module) main();
