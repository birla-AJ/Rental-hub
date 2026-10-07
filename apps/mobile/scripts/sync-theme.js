#!/usr/bin/env node
// The colour tokens are shared with the web app (packages/theme). The mobile app keeps its own copy so Metro never has to
// reach outside this folder. `npm run sync:theme` refreshes it; `--check` fails if the copies differ.
const fs = require('fs');
const path = require('path');

const from = path.resolve(__dirname, '../../../packages/theme/tokens.js'), to = path.resolve(__dirname, '../src/shared/tokens.js');
const inSync = () => fs.readFileSync(from, 'utf8') === fs.readFileSync(to, 'utf8');
if (process.argv.includes('--check')) { if (!inSync()) { console.error('src/shared/tokens.js is out of date — run: npm run sync:theme'); process.exit(1); } console.log('Theme tokens are in sync.'); }
else { fs.copyFileSync(from, to); console.log('Theme tokens copied to src/shared/tokens.js'); }
