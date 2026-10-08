import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const { check } = createRequire(import.meta.url)('../scripts/check-jsx-names.cjs');

test('every component used in the real mobile and web code is imported or defined', () => {
  assert.deepEqual(check(['apps/mobile/src', 'apps/mobile/App.js', 'apps/web/src'].map((p) => path.resolve(p))), []);
});
test('the guard really catches "X is not defined" (the bug that once broke the owner and agent dashboards)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rh-jsx-'));
  fs.writeFileSync(path.join(dir, 'Bad.jsx'), "import React from 'react';\nimport { Known } from './k';\nexport default function A({ Passed }) { const Local = () => null; return <div><Known /><Local /><Passed /><OwnerHome go={1} /></div>; }\n");
  fs.writeFileSync(path.join(dir, 'Good.jsx'), "import React, { useState } from 'react';\nimport * as UI from './ui';\nconst X = () => <span />;\n// <NotReal /> inside a comment must be ignored\nexport default () => <><X /><UI.Card /></>;\n");
  assert.deepEqual(check([dir]).map((e) => e.replace(/^.*\//, '')), ['Bad.jsx: <OwnerHome> is used but never imported or defined']);
  fs.rmSync(dir, { recursive: true, force: true });
});
