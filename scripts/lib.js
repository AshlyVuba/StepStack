const fs = require('fs');
const path = require('path');

// Loaded on demand after onboarding, so it does not count toward the initial budget.
const LAZY = ['src/js/exercises.js'];

// All shipped client files: index.html plus everything under src/ (excluding package.json markers).
function clientFiles(root = '.') {
  const out = ['index.html'];
  (function walk(dir) {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.posix.join(dir, e.name);
      if (e.isDirectory()) walk(rel);
      else if (e.name !== 'package.json') out.push(rel);
    }
  })('src');
  return out;
}

// Removes comments so rules only match real code.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
}

module.exports = { clientFiles, stripComments, LAZY };