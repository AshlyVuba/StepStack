// Enforces the guardrails from Issues #1, #2 and #3:
//  - no heavy third-party UI libraries (external resources, package imports, runtime deps)
//  - no raw HTML injection or dynamic code execution in client JS
//  - no session tokens or learner data in unencrypted browser storage
//    (localStorage, sessionStorage, cookies). Learner data goes through src/js/vault.js.
//    The only allowed use is localStorage.removeItem(...) to delete legacy data.
const fs = require('fs');
const { clientFiles, sourceFiles, stripComments } = require('./lib');
const errors = [];

const html = fs.readFileSync('index.html', 'utf8');
(html.match(/<(?:script|link)[^>]+(?:src|href)=["']https?:\/\/[^"']+["']/gi) || [])
  .forEach((tag) => errors.push(`External resource in index.html: ${tag}`));

const UNSAFE_HTML = /\b(innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML|document\.write(ln)?)\b|\beval\s*\(|\bnew\s+Function\s*\(/g;
const PLAIN_STORAGE = /\b(?:localStorage|sessionStorage)\b(?!\.removeItem\()|\bdocument\.cookie\b/g;

for (const f of [...clientFiles(), ...sourceFiles()].filter((x) => x.endsWith('.js'))) {
  const src = stripComments(fs.readFileSync(f, 'utf8'));
  (src.match(/^\s*import\s[^'"]*['"](?![./])[^'"]+['"]/gm) || [])
    .forEach((i) => errors.push(`Third-party import in ${f}: ${i.trim()}`));
  (src.match(UNSAFE_HTML) || [])
    .forEach((m) => errors.push(`Unsafe API "${m}" in ${f}: render with textContent instead`));
  (src.match(PLAIN_STORAGE) || [])
    .forEach((m) => errors.push(`Unencrypted storage "${m}" in ${f}: use the encrypted vault (src/js/vault.js)`));
}

if (fs.existsSync('package.json')) {
  const deps = Object.keys(JSON.parse(fs.readFileSync('package.json', 'utf8')).dependencies || {});
  if (deps.length) errors.push(`Runtime dependencies not allowed: ${deps.join(', ')}`);
}

if (errors.length) { errors.forEach((e) => console.error('✗ ' + e)); process.exit(1); }
console.log('✓ Guardrails passed: no external resources, third-party imports, HTML injection or unencrypted storage');