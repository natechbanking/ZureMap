#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const statsPath = path.resolve(process.cwd(), process.argv[2] || 'dist/zuremap/stats.json');
if (!fs.existsSync(statsPath)) {
  console.error(`stats file not found: ${statsPath}`);
  process.exit(1);
}

const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
const outputs = stats.outputs && typeof stats.outputs === 'object' ? stats.outputs : {};

const jsEntries = Object.entries(outputs).filter(([name]) => name.endsWith('.js'));

const nonDynamicGraph = new Map();
for (const [name, meta] of jsEntries) {
  const imports = Array.isArray(meta.imports) ? meta.imports : [];
  nonDynamicGraph.set(
    name,
    imports
      .filter(i => i && i.path && i.kind !== 'dynamic-import')
      .map(i => i.path)
      .filter(p => typeof p === 'string' && p.endsWith('.js'))
  );
}

const rootJs = jsEntries
  .filter(([, meta]) => typeof meta.entryPoint === 'string' &&
    (meta.entryPoint === 'src/main.ts' || String(meta.entryPoint).startsWith('angular:polyfills')))
  .map(([name]) => name);

const visited = new Set();
const stack = [...rootJs];
while (stack.length) {
  const cur = stack.pop();
  if (!cur || visited.has(cur)) continue;
  visited.add(cur);
  for (const dep of nonDynamicGraph.get(cur) || []) stack.push(dep);
}

const initialBytes = [...visited].reduce((sum, name) => sum + (outputs[name]?.bytes || 0), 0);
const elkAssets = jsEntries
  .filter(([, meta]) => String(meta.entryPoint || '').includes('node_modules/elkjs/'))
  .map(([name, meta]) => ({ name, size: meta.bytes || 0 }));

const MB = 1024 * 1024;
const maxInitialBytes = 420 * 1024;
const maxElkAssets = 1;
const maxElkSize = 1.6 * MB;

let hasError = false;

if (initialBytes > maxInitialBytes) {
  console.error(
    `Initial JS too large: ${(initialBytes / 1024).toFixed(1)} kB > ${(maxInitialBytes / 1024).toFixed(1)} kB`
  );
  hasError = true;
}

if (elkAssets.length > maxElkAssets) {
  console.error(`Expected at most ${maxElkAssets} ELK bundle asset, found ${elkAssets.length}`);
  hasError = true;
}

for (const asset of elkAssets) {
  if ((asset.size || 0) > maxElkSize) {
    console.error(
      `ELK asset too large (${asset.name}): ${((asset.size || 0) / MB).toFixed(2)} MB > ${(maxElkSize / MB).toFixed(2)} MB`
    );
    hasError = true;
  }
}

const info = {
  initialJsKb: Number((initialBytes / 1024).toFixed(1)),
  elkAssets: elkAssets.map(a => ({ name: a.name, kb: Number(((a.size || 0) / 1024).toFixed(1)) })),
};
console.log('bundle-stats:', JSON.stringify(info));

if (hasError) process.exit(2);
