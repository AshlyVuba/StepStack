// Fails if the shipped payload (HTML + CSS + JS, gzipped) exceeds the budget.
// Usage: node scripts/check-bundle-size.js
const fs = require('fs');
const zlib = require('zlib');
const { clientFiles } = require('./lib');
const BUDGET_KB = 15;
let total = 0;
for (const f of clientFiles()) {
  const gz = zlib.gzipSync(fs.readFileSync(f)).length;
  total += gz;
  console.log(`${f.padEnd(28)} ${(gz / 1024).toFixed(2)} KB gzip`);
}
const kb = total / 1024;
console.log(`TOTAL ${kb.toFixed(2)} KB (budget ${BUDGET_KB} KB)`);
if (kb > BUDGET_KB) { console.error('Over budget'); process.exit(1); }