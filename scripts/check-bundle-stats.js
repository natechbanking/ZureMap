#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const statsPath = path.resolve(process.cwd(), process.argv[2] || 'dist/zuremap/stats.json');
if (!fs.existsSync(statsPath)) {
  console.error(`stats file not found: ${statsPath}`);
  process.exit(1);
}

const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
const chunks = Array.isArray(stats.chunks) ? stats.chunks : [];
const assets = Array.isArray(stats.assets) ? stats.assets : [];

const chunkById = new Map(chunks.map(c => [c.id, c]));
const chunkInitial = new Map(chunks.map(c => [c.id, !!c.initial]));

const jsAssets = assets.filter(a => typeof a.name === 'string' && a.name.endsWith('.js'));
const initialBytes = jsAssets
  .filter(a => Array.isArray(a.chunks) && a.chunks.some(id => chunkInitial.get(id)))
  .reduce((sum, a) => sum + (a.size || 0), 0);

const elkAssets = jsAssets.filter(a => /elk-bundled/i.test(a.name));

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
