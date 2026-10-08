#!/usr/bin/env node
// Finds the bug "ReferenceError: X is not defined": a component used as <X /> that is never imported or declared in that file.
// (A syntax check cannot see this; it only shows up when someone opens that screen.)  Usage: node scripts/check-jsx-names.js [dir ...]
const fs = require('fs');
const path = require('path');

const SKIP = new Set(['node_modules', 'android', 'ios', 'dist', 'build', '.git']);
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.(js|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function declaredNames(src) {
  const names = new Set();
  for (const m of src.matchAll(/import\s+([^;]+?)\s+from\s+['"][^'"]+['"]/g)) {
    const clause = m[1];
    const def = /^([A-Za-z_$][\w$]*)/.exec(clause); if (def) names.add(def[1]);
    const ns = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(clause); if (ns) names.add(ns[1]);
    const named = /\{([^}]*)\}/.exec(clause); if (named) for (const part of named[1].split(',')) { const n = part.trim().split(/\s+as\s+/).pop(); if (n) names.add(n); }
  }
  for (const m of src.matchAll(/\b(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of src.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) for (const part of m[1].split(',')) { const n = part.trim().split(':').pop().trim().split('=')[0].trim(); if (n) names.add(n); }
  for (const m of src.matchAll(/\b(?:const|let|var)\s*\[([^\]]*)\]\s*=/g)) for (const part of m[1].split(',')) { const n = part.trim().split('=')[0].trim(); if (n) names.add(n); }
  for (const m of src.matchAll(/\(\s*\{([^}]*)\}\s*\)\s*=>|function\s*\w*\s*\(\s*\{([^}]*)\}/g)) for (const part of (m[1] ?? m[2]).split(',')) { const n = part.trim().split(':').pop().trim().split('=')[0].trim(); if (n) names.add(n); }   // destructured props
  for (const m of src.matchAll(/\(([^()]*)\)\s*=>/g)) for (const part of m[1].split(',')) { const n = part.trim().split('=')[0].replace(/[{}[\]]/g, '').trim(); if (/^[A-Za-z_$][\w$]*$/.test(n)) names.add(n); }
  for (const m of src.matchAll(/function\s*\w*\s*\(([^)]*)\)/g)) for (const part of m[1].split(',')) { const n = part.trim().split('=')[0].replace(/[{}[\]]/g, '').trim(); if (/^[A-Za-z_$][\w$]*$/.test(n)) names.add(n); }
  return names;
}

function check(targets) {
  const errors = [];
  for (const target of targets) for (const f of (fs.statSync(target).isDirectory() ? walk(target) : [target])) {
    const src = stripComments(fs.readFileSync(f, 'utf8')), have = declaredNames(src), seen = new Set();
    for (const m of src.matchAll(/<([A-Z][A-Za-z0-9_]*)(?=[\s/>.])/g)) {
      if (!have.has(m[1]) && !seen.has(m[1])) { seen.add(m[1]); errors.push(`${path.relative(process.cwd(), f)}: <${m[1]}> is used but never imported or defined`); }
    }
  }
  return errors;
}
module.exports = { check };
if (require.main === module) {
  const given = process.argv.slice(2).map((d) => path.resolve(d));
  const targets = (given.length ? given : ['apps/mobile/src', 'apps/mobile/App.js', 'apps/web/src'].map((d) => path.resolve(d))).filter(fs.existsSync);
  const errs = check(targets);
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  console.log(`OK — every component used in JSX is imported or defined (${targets.length} locations checked).`);
}
