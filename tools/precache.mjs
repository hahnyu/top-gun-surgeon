// Writes the offline precache list into sw.js (run before every deploy):  node tools/precache.mjs
// Lists every app file plus the CDN modules the game imports (three.js, its add-ons and their
// own imports, Rapier) so a tablet that opened the game once can play offline.
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const skip = new Set(['tools', '.git', 'node_modules', 'README.md', 'ROADMAP.md', 'sw.js']);
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    if (skip.has(n) || n.startsWith('.')) continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p); else files.push('./' + relative(root, p));
  }
})(root);
files.unshift('./');

const T = 'https://cdn.jsdelivr.net/npm/three@0.171.0/';
const cdn = [
  T + 'build/three.module.js', T + 'build/three.core.js',
  ...['environments/RoomEnvironment.js', 'loaders/GLTFLoader.js', 'utils/BufferGeometryUtils.js',
    'postprocessing/EffectComposer.js', 'postprocessing/Pass.js', 'postprocessing/MaskPass.js', 'postprocessing/ShaderPass.js',
    'postprocessing/RenderPass.js', 'postprocessing/OutputPass.js', 'postprocessing/UnrealBloomPass.js',
    'shaders/CopyShader.js', 'shaders/LuminosityHighPassShader.js', 'shaders/OutputShader.js'].map((f) => T + 'examples/jsm/' + f),
  'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.14.0/rapier.es.js',
  'https://fonts.googleapis.com/css2?family=Bungee&family=Atkinson+Hyperlegible:wght@400;700&display=swap',
];

const sw = join(root, 'sw.js');
const src = readFileSync(sw, 'utf8');
const list = JSON.stringify([...files.sort(), ...cdn], null, 1);
const version = 'tgs-' + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const out = src.replace(/const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = ${list};`).replace(/const CACHE = '[^']*';/, `const CACHE = '${version}';`);
writeFileSync(sw, out);
console.log(`sw.js: ${files.length} app files + ${cdn.length} CDN files, cache ${version}`);
