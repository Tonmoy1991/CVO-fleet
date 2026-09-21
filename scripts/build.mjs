// Build: fuses template + CSS + JS + embedded data into ONE self-contained HTML (dist/index.html).
// No dependencies. Usage: node scripts/build.mjs [--csv path] [--out path]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const csvPath = resolve(root, arg('--csv', 'data/TonmoyTest_2026_09_18.csv'));
const outPath = resolve(root, arg('--out', 'dist/index.html'));

function parseCSV(text) { // same rules as the in-app parser (RFC 4180 quotes, CRLF/LF)
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const columns = rows.shift().map(h => h.replace(/^\ufeff/, ''));
  return { columns, rows: rows.filter(r => r.length > 1) };
}
const csv = parseCSV(readFileSync(csvPath, 'utf8'));
const safe = (s) => s.replace(/<\//g, '<\\/');
const data = safe(JSON.stringify({ columns: csv.columns, rows: csv.rows }));
const gaz = safe(JSON.stringify(JSON.parse(readFileSync(resolve(root, 'data/cloud_region_gazetteer.json'), 'utf8'))));
const stamp = arg('--stamp', new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC');
let html = readFileSync(resolve(root, 'src/index.template.html'), 'utf8');
html = html.replace('/*__CSS__*/', () => readFileSync(resolve(root, 'src/styles/app.css'), 'utf8'));
html = html.replace('/*__JS__*/', () => readFileSync(resolve(root, 'src/scripts/app.js'), 'utf8').replace(/<\/script/g, '<\\/script'));
html = html.replace('__BUILD__', stamp).replace('__DATA__', () => data).replace('__GAZ__', () => gaz);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html);
console.log(`built ${outPath} · ${html.length.toLocaleString()} bytes · ${csv.rows.length} rows · build ${stamp}`);
