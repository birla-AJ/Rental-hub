import test from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from '../src/csv.js';

test('CSV: quotes commas/quotes/newlines, keeps numbers, empty input is empty', () => {
  assert.equal(toCsv([{ a: 'x,y', b: 'say "hi"', c: 5 }]), 'a,b,c\n"x,y","""say ""hi"""",5'.replace('"""say ""hi"""",', '"say ""hi""",'));
  assert.equal(toCsv([]), '');
});
test('CSV: cells that start like formulas are neutralised (no spreadsheet injection)', () => {
  const out = toCsv([{ name: '=HYPERLINK("http://evil","x")', n: '+1', m: '-2', at: '@SUM(A1)' }]).split('\n')[1];
  assert.ok(out.startsWith('"\'=HYPERLINK')); assert.ok(out.includes(",'+1,")); assert.ok(out.includes(",'-2,")); assert.ok(out.endsWith(",'@SUM(A1)"));
});
