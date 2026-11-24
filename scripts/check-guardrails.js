// Enforces the guardrails from Issues #1 and #2:
//  - no heavy third-party UI libraries (external resources, package imports, runtime deps)
//  - no raw HTML injection or dynamic code execution in client JS
const fs = require('fs');
const { clientFiles } = require('./lib');
const errors = [];

const html = fs.readFileSync('index.html', 'utf8');
(html.match(/<(?:script|link)[^>]+(?:src|href)=["']https?:\/\/[^"']+["']/gi) || [])
  .forEach((tag) => errors.push(`External resource in index.html: ${tag}`));

const FORBIDDEN = /\b(innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML|document\.write(ln)?)\b|\beval\s*\(|\bnew\s+Function\s*\(/g;
for (const f of clientFiles().filter((x) => x.endsWith('.js'))) {
  const src = fs.readFileSync(f, 'utf8');
  (src.match(/^\s*import\s[^'"]*['"](?![./])[^'"]+['"]/gm) || [])
    .forEach((i) => errors.push(`Third-party import in ${f}: ${i.trim()}`));
  (src.match(FORBIDDEN) || [])
    .forEach((m) => errors.push(`Unsafe API "${m}" in ${f}: render with textContent instead`));
}

if (fs.existsSync('package.json')) {
  const deps = Object.keys(JSON.parse(fs.readFileSync('package.json', 'utf8')).dependencies || {});
  if (deps.length) errors.push(`Runtime dependencies not allowed: ${deps.join(', ')}`);
}

if (errors.length) { errors.forEach((e) => console.error('✗ ' + e)); process.exit(1); }
console.log('✓ Guardrails passed: no external resources, third-party imports or HTML injection');