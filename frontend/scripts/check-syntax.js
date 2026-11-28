const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const jsDir = path.join(root, 'src', 'js');
const files = fs.readdirSync(jsDir).filter((name) => name.endsWith('.js')).sort();

for (const file of files) {
  const absolute = path.join(jsDir, file);
  const result = spawnSync(process.execPath, ['--check', absolute], {
    cwd: root,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || `Syntax check failed: ${file}\n`);
    process.exit(result.status || 1);
  }
}

console.log(`✓ Syntax checks passed: ${files.length} JavaScript modules`);
