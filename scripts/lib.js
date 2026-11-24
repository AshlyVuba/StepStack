const fs = require('fs');
const path = require('path');
// All shipped client files: index.html plus everything under src/ (excluding package.json markers).
function clientFiles(root = '.') {
  const out = ['index.html'];
  (function walk(dir) {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) walk(rel);
      else if (e.name !== 'package.json') out.push(rel);
    }
  })('src');
  return out;
}
module.exports = { clientFiles };