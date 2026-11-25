// Fails if the shipped payload (HTML + CSS + JS, gzipped) exceeds a budget.
//  - INITIAL: everything loaded at startup (excludes lazy-loaded exercise content)
//  - TOTAL:   every client file
// Usage: node scripts/check-bundle-size.js
const fs = require('fs');
const zlib = require('zlib');
const { clientFiles, LAZY } = require('./lib');
const BUDGET_INITIAL_KB = 15;
const BUDGET_TOTAL_KB = 25;

let initial = 0;
let total = 0;
for (const f of clientFiles()) {
  const gz = zlib.gzipSync(fs.readFileSync(f)).length;
  total += gz;
  const lazy = LAZY.includes(f);
  if (!lazy) initial += gz;
  console.log(`${f.padEnd(28)} ${(gz / 1024).toFixed(2)} KB gzip${lazy ? '  (lazy)' : ''}`);
}
const kb = (n) => n / 1024;
console.log(`INITIAL ${kb(initial).toFixed(2)} KB (budget ${BUDGET_INITIAL_KB} KB)`);
console.log(`TOTAL   ${kb(total).toFixed(2)} KB (budget ${BUDGET_TOTAL_KB} KB)`);
if (kb(initial) > BUDGET_INITIAL_KB || kb(total) > BUDGET_TOTAL_KB) {
  console.error('Over budget');
  process.exit(1);
}