const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { check } = require('../scripts/check-imports');
const { patchBuildGradle, patchManifest, patchPlist } = require('../scripts/add-native');

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
