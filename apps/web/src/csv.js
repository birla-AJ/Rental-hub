// Spreadsheet programs run text starting with = + - @ as formulas; prefix such cells so a downloaded report can't execute anything.
const cell = (v) => { let x = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(x)) x = "'" + x; return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
export const toCsv = (rows) => (rows.length ? [Object.keys(rows[0]).join(','), ...rows.map((r) => Object.values(r).map(cell).join(','))].join('\n') : '');
