#!/usr/bin/env node
// Guards the project: no Expo, no TypeScript, every import resolves, every package imported is declared in package.json.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', 'android', 'ios', 'scripts', 'test', '.git']);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

function check(base = root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf8'));
  const declared = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {}), ...Object.keys(pkg.optionalNative ?? {})]);   // optionalNative: installed only by the opt-in scripts
  const errors = [];
  const files = walk(base);
  for (const f of files) if (/\.(ts|tsx)$/.test(f) || /tsconfig/.test(path.basename(f))) errors.push(`TypeScript file not allowed: ${path.relative(base, f)}`);
  for (const d of declared) if (/^expo(-|$)/.test(d)) errors.push(`Expo package declared: ${d}`);
  const re = /(?:from\s+|import\s+|require\()\s*['"]([^'"]+)['"]/g;
  for (const f of files.filter((x) => /\.js$/.test(x))) {
    const src = fs.readFileSync(f, 'utf8'); let m;
    while ((m = re.exec(src))) {
      const spec = m[1], rel = path.relative(base, f);
      if (spec.startsWith('.')) {
        const target = path.resolve(path.dirname(f), spec);
        const ok = [target, target + '.js', target + '.json', path.join(target, 'index.js')].some((c) => fs.existsSync(c) && fs.statSync(c).isFile());
        if (!ok) errors.push(`${rel}: cannot resolve '${spec}'`);
      } else {
        const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
        if (/^expo(-|$)/.test(name)) errors.push(`${rel}: imports Expo package '${spec}'`);
        else if (!declared.has(name)) errors.push(`${rel}: '${name}' is not in package.json`);
      }
    }
  }
  return { errors, files: files.length };
}

module.exports = { check };
if (require.main === module) {
  const { errors, files } = check();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(`OK — ${files} files checked: JavaScript only, no Expo, all imports resolve and are declared.`);
}
