/**
 * Packs all packages in topological order into tarballs to verify npm packaging
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const PACKAGES = [
  'packages/shared',
  'packages/core',
  'packages/node',
  'packages/react',
  'packages/vue',
  'packages/angular',
  'packages/ai',
  'packages/cli',
];

const outDir = path.resolve('tarballs');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('Packaging all WhatItBroke packages for npm release...\n');

// 1. Build all packages first
console.log('Building all packages...');
execSync('npm.cmd run build', { stdio: 'inherit' });

// 2. Pack each
for (const pkgDir of PACKAGES) {
  const absPkgDir = path.resolve(pkgDir);
  const pkgJson = JSON.parse(fs.readFileSync(path.join(absPkgDir, 'package.json'), 'utf-8'));
  console.log(`\n📦 Packing ${pkgJson.name}@${pkgJson.version}...`);

  const packOutput = execSync(`npm.cmd pack --pack-destination="${outDir}"`, {
    cwd: absPkgDir,
    encoding: 'utf-8',
  }).trim();

  console.log(`   ✔ Generated: ${packOutput}`);
}

console.log('\n✔ All tarballs packed successfully into ./tarballs/');
