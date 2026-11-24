// Builds dist/: the UI plus the search logic bundled for the browser (demo data only).
// Used by .github/workflows/pages.yml; try it locally with `npm run build:static && npm run preview`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(path.join(root, 'public'), dist, { recursive: true });

await build({
  entryPoints: [path.join(root, 'static', 'backend.js')],
  outfile: path.join(dist, 'js', 'backend.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  minify: true,
  legalComments: 'none',
  logLevel: 'warning',
});

const indexFile = path.join(dist, 'index.html');
const html = fs.readFileSync(indexFile, 'utf8');
const marker = '<script type="module" src="js/app.js"></script>';
if (!html.includes(marker)) throw new Error('index.html: app script tag not found');
fs.writeFileSync(indexFile, html.replace(marker, `<script>window.FARESCOPE_STATIC = true;</script>\n  ${marker}`));
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

const kb = (f) => (fs.statSync(path.join(dist, f)).size / 1024).toFixed(1);
console.log(`dist/ ready · js/backend.js ${kb('js/backend.js')} KB`);
