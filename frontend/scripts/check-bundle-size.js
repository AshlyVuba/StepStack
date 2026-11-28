// Fails if shipped assets exceed gzip budgets. Initial JS follows static imports from main.js.
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const { clientFiles } = require('./lib');
const BUDGET_INITIAL_KB = 15;
const BUDGET_TOTAL_KB = 25;

const meta = JSON.parse(fs.readFileSync('scripts/.build-meta.json', 'utf8'));
const outputs = meta.outputs;
const entry = Object.keys(outputs).find((file) => outputs[file].entryPoint === 'src/js/main.js');
if (!entry) throw new Error('Production main.js entry missing; run npm run build first');
const initialFiles = new Set(['index.html', 'src/css/app.css']);
function addStaticImports(file) {
  if (initialFiles.has(file)) return;
  initialFiles.add(file);
  (outputs[file]?.imports || []).filter((item) => item.kind === 'import-statement')
    .forEach((item) => addStaticImports(path.posix.join(path.posix.dirname(file), item.path)));
}
addStaticImports(entry);

let initial = 0;
let total = 0;
for (const f of clientFiles()) {
  const gz = zlib.gzipSync(fs.readFileSync(f)).length;
  total += gz;
  const lazy = !initialFiles.has(f);
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