// Enforces the Issue #1 guardrail: no heavy third-party UI libraries.
// Fails if index.html pulls scripts/styles from another origin, or if
// package.json declares runtime "dependencies".
const fs = require('fs');
const errors = [];

const html = fs.readFileSync('index.html', 'utf8');
const external = html.match(/<(?:script|link)[^>]+(?:src|href)=["']https?:\/\/[^"']+["']/gi) || [];
external.forEach((tag) => errors.push(`External resource in index.html: ${tag}`));

for (const f of ['src/js/config.js', 'src/js/storage.js', 'src/js/onboarding.js']) {
  const src = fs.readFileSync(f, 'utf8');
  const bare = src.match(/^\s*import\s[^'"]*['"](?![./])[^'"]+['"]/gm) || [];
  bare.forEach((i) => errors.push(`Third-party import in ${f}: ${i.trim()}`));
}

if (fs.existsSync('package.json')) {
  const deps = Object.keys(JSON.parse(fs.readFileSync('package.json', 'utf8')).dependencies || {});
  if (deps.length) errors.push(`Runtime dependencies not allowed: ${deps.join(', ')}`);
}

if (errors.length) { errors.forEach((e) => console.error('✗ ' + e)); process.exit(1); }
console.log('✓ Guardrails passed: no external resources or third-party imports');