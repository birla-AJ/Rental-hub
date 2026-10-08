const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { check } = require('../scripts/check-imports');
const { patchBuildGradle, patchManifest, patchPlist } = require('../scripts/add-native');
const push = require('../scripts/enable-push');

const root = path.resolve(__dirname, '..');

test('the app is plain JavaScript with no Expo, and every import resolves to a declared package', () => {
  const { errors, files } = check(root);
  assert.deepEqual(errors, []);
  assert.ok(files > 30);
});
test('the checker really catches Expo, TypeScript, missing files and undeclared packages', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rh-check-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { react: '1', expo: '1' } }));
  fs.writeFileSync(path.join(dir, 'a.js'), "import x from 'expo-camera';\nimport y from './missing';\nimport z from 'left-pad';\nimport r from 'react';\n");
  fs.writeFileSync(path.join(dir, 'b.tsx'), '');
  const msg = check(dir).errors.join('\n');
  for (const want of ['Expo package declared: expo', "imports Expo package 'expo-camera'", "cannot resolve './missing'", "'left-pad' is not in package.json", 'TypeScript file not allowed']) assert.ok(msg.includes(want), want);
  fs.rmSync(dir, { recursive: true, force: true });
});
test('package.json is a bare React Native CLI app', () => {
  const p = require('../package.json');
  assert.equal(p.scripts.android, 'react-native run-android'); assert.equal(p.scripts.ios, 'react-native run-ios');
  assert.ok(p.dependencies['react-native'] && p.dependencies['react-native-vision-camera'] && p.dependencies['react-native-keychain']);
  assert.ok(p.devDependencies['@react-native-community/cli']);
  assert.equal(require('../app.json').name, 'RentalHub');
  assert.ok(fs.existsSync(path.join(root, 'index.js')));
});
test('theme tokens match the shared package', () => {
  assert.equal(fs.readFileSync(path.join(root, 'src/shared/tokens.js'), 'utf8'), fs.readFileSync(path.join(root, '../../packages/theme/tokens.js'), 'utf8'));
});

const MANIFEST = `<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n\n    <uses-permission android:name="android.permission.INTERNET" />\n\n    <application\n      android:name=".MainApplication">\n    </application>\n</manifest>\n`;
const PLIST = `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n\t<key>CFBundleName</key>\n\t<string>$(PRODUCT_NAME)</string>\n</dict>\n</plist>\n`;
test('native patches: camera + location permissions, plist usage texts, minSdk 26 — and applying twice changes nothing', () => {
  const m = patchManifest(MANIFEST);
  assert.ok(m.includes('android.permission.CAMERA') && m.includes('ACCESS_FINE_LOCATION') && m.indexOf('CAMERA') < m.indexOf('<application'));
  assert.equal(patchManifest(m), m);
  const p = patchPlist(PLIST);
  for (const k of ['NSCameraUsageDescription', 'NSLocationWhenInUseUsageDescription', 'NSPhotoLibraryUsageDescription']) assert.ok(p.includes(`<key>${k}</key>`), k);
  assert.ok(p.trimEnd().endsWith('</dict>\n</plist>')); assert.equal(patchPlist(p), p);
  assert.equal(patchBuildGradle('ext {\n  minSdkVersion = 24\n}'), 'ext {\n  minSdkVersion = 26\n}');
  assert.equal(patchBuildGradle('minSdkVersion = 28'), 'minSdkVersion = 28');                         // never lowers it
});

test('push is off by default, Firebase is optional, and the app still bundles without it', () => {
  assert.match(fs.readFileSync(path.join(root, 'src/config.js'), 'utf8'), /PUSH_ENABLED = false;/);
  const p = require('../package.json'); assert.ok(p.optionalNative['@react-native-firebase/messaging']); assert.equal(p.dependencies['@react-native-firebase/messaging'], undefined);
  assert.match(fs.readFileSync(path.join(root, 'metro.config.js'), 'utf8'), /allowOptionalDependencies: true/);
  assert.match(fs.readFileSync(path.join(root, 'src/native/push.js'), 'utf8'), /try \{ messaging = require\('@react-native-firebase\/messaging'\)/);
});
test('push native patches are idempotent and put things where Firebase needs them', () => {
  const proj = "buildscript {\n    ext { minSdkVersion = 26 }\n    dependencies {\n        classpath(\"com.android.tools.build:gradle\")\n    }\n}\n";
  const a = push.patchProjectGradle(proj); assert.ok(a.includes("com.google.gms:google-services:4.4.2")); assert.equal(push.patchProjectGradle(a), a); assert.ok(a.indexOf('google-services') < a.indexOf('com.android.tools.build'));
  const app = push.patchAppGradle('apply plugin: "com.android.application"\n'); assert.ok(app.trimEnd().endsWith('apply plugin: "com.google.gms.google-services"')); assert.equal(push.patchAppGradle(app), app);
  const m = push.patchManifestPush(MANIFEST); assert.ok(m.includes('POST_NOTIFICATIONS') && m.indexOf('POST_NOTIFICATIONS') < m.indexOf('<application')); assert.equal(push.patchManifestPush(m), m);
  const pod = "prepare_react_native_project!\n\ntarget 'RentalHub' do\nend\n"; const pp = push.patchPodfile(pod); assert.ok(pp.includes('$RNFirebaseAsStaticFramework = true') && pp.includes('use_frameworks! :linkage => :static')); assert.equal(push.patchPodfile(pp), pp);
  const del = '#import "AppDelegate.h"\n\n@implementation AppDelegate\n\n- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions\n{\n  self.moduleName = @"RentalHub";\n  return YES;\n}\n@end\n';
  const d = push.patchAppDelegate(del); assert.ok(d.includes('#import <Firebase.h>') && d.includes('[FIRApp configure];')); assert.ok(d.indexOf('[FIRApp configure]') < d.indexOf('self.moduleName')); assert.equal(push.patchAppDelegate(d), d);
  assert.equal(push.setPushFlag('export const PUSH_ENABLED = false;'), 'export const PUSH_ENABLED = true;'); assert.equal(push.setPushFlag('export const PUSH_ENABLED = true;', false), 'export const PUSH_ENABLED = false;');
});
