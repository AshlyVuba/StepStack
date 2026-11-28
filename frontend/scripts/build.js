const fs = require('fs');
const path = require('path');
const { build } = require('esbuild');
const { clientFiles } = require('./lib');

const outdir = path.resolve('dist');
if (path.dirname(outdir) !== process.cwd()) throw new Error('Unexpected frontend build output path');
fs.rmSync(outdir, { recursive: true, force: true });

async function main() {
  const result = await build({
    entryPoints: ['src/js/main.js'],
    outdir: 'dist/js',
    entryNames: '[name]',
    chunkNames: 'chunks/[name]-[hash]',
    bundle: true,
    splitting: true,
    format: 'esm',
    target: 'es2022',
    minify: true,
    metafile: true
  });
  fs.writeFileSync('scripts/.build-meta.json', JSON.stringify(result.metafile));

  const assets = ['./', ...clientFiles(), 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
  const shell = [
    'const SHELL = [',
    ...assets.map((file) => `  '${file === './' ? './' : `./${file}`}',`),
    '];'
  ].join('\n');
  const sw = fs.readFileSync('sw.js', 'utf8');
  const updated = sw.replace(/const SHELL = \[[\s\S]*?\];/, shell);
  if (updated === sw && !sw.includes(shell)) throw new Error('Could not update service worker shell');
  fs.writeFileSync('sw.js', updated);
  console.log(`✓ Frontend build complete: ${result.outputFiles?.length || Object.keys(result.metafile.outputs).length} bundled assets`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
