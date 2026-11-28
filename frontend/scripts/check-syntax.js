const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { sourceFiles, clientFiles } = require('./lib');

const root = path.resolve(__dirname, '..');
const files = [...sourceFiles(root), ...clientFiles(root).filter((name) => name.endsWith('.js'))].sort();

for (const relative of files) {
  const absolute = path.join(root, relative);
  const result = spawnSync(process.execPath, ['--check', absolute], {
    cwd: root,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || `Syntax check failed: ${relative}\n`);
    process.exit(result.status || 1);
  }
}

console.log(`✓ Syntax checks passed: ${files.length} JavaScript modules`);
