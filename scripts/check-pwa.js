// Verifies the PWA is installable and fully available offline:
//  - every client file, the manifest and its icons are pre-cached by sw.js
//  - nothing listed in sw.js is missing from disk
//  - the manifest has the fields browsers need, and index.html links it
const fs = require('fs');
const { clientFiles } = require('./lib');
const errors = [];

const sw = fs.readFileSync('sw.js', 'utf8');
const match = sw.match(/const SHELL = \[([\s\S]*?)\];/);
if (!match) { console.error('✗ Could not find SHELL list in sw.js'); process.exit(1); }
const shell = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const norm = (p) => p.replace(/^\.\//, '');

const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
for (const key of ['name', 'short_name', 'start_url', 'display', 'icons']) {
  if (!manifest[key]) errors.push(`manifest.webmanifest is missing "${key}"`);
}
if (manifest.start_url && !manifest.start_url.startsWith('.')) {
  errors.push('manifest start_url must be relative so the app works under a sub-path (e.g. GitHub Pages)');
}
const iconFiles = (manifest.icons || []).map((i) => i.src);
const sizes = (manifest.icons || []).map((i) => i.sizes);
['192x192', '512x512'].forEach((s) => { if (!sizes.includes(s)) errors.push(`manifest needs a ${s} icon`); });

const required = [...clientFiles(), 'manifest.webmanifest', ...iconFiles];
for (const f of required) {
  if (!shell.map(norm).includes(norm(f))) errors.push(`sw.js SHELL is missing "${f}" (it would not work offline)`);
}
for (const f of shell) {
  if (f === './') continue;
  if (!fs.existsSync(norm(f))) errors.push(`sw.js SHELL lists "${f}" but the file does not exist`);
}
if (!shell.includes('./')) errors.push('sw.js SHELL should include "./" so the start URL loads offline');
if (!fs.readFileSync('index.html', 'utf8').includes('rel="manifest"')) errors.push('index.html does not link the manifest');

if (errors.length) { errors.forEach((e) => console.error('✗ ' + e)); process.exit(1); }
console.log(`✓ PWA checks passed: ${shell.length} files pre-cached, manifest valid`);