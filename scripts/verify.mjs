// Confirms the project build reproduces the released single file byte-for-byte.
import { readFileSync, existsSync } from 'node:fs';
const a = existsSync('release/cvo-fleet.html') ? readFileSync('release/cvo-fleet.html') : null;
const b = readFileSync('dist/verify.html');
if (!a) { console.log('release/cvo-fleet.html not present — skipping comparison'); process.exit(0); }
if (a.equals(b)) console.log(`IDENTICAL — dist/verify.html matches release/cvo-fleet.html (${b.length.toLocaleString()} bytes)`);
else { console.error('DIFFERENT — the build no longer reproduces the released file'); process.exit(1); }
