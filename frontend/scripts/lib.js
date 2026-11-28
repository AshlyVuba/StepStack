const fs = require('fs');
const path = require('path');

// Shipped assets only; unbundled source stays in src/js and is checked separately.
function clientFiles(root = '.') {
  const out = ['index.html', 'src/css/app.css'];
  (function walk(dir) {
    if (!fs.existsSync(path.join(root, dir))) return;
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.posix.join(dir, e.name);
      if (e.isDirectory()) walk(rel);
      else out.push(rel);
    }
  })('dist');
  return out;
}

function sourceFiles(root = '.') {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.posix.join(dir, e.name);
      if (e.isDirectory()) walk(rel);
      else if (e.name.endsWith('.js')) out.push(rel);
    }
  })('src/js');
  return out;
}

// Removes comments so rules only match real code.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
}

module.exports = { clientFiles, sourceFiles, stripComments };