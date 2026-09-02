/**
 * WhatItBroke - Topological Build Script
 * Builds monorepo packages in dependency order so type declarations are always available.
 */

import { execSync } from 'node:child_process';
import * as path from 'node:path';

const BUILD_ORDER = [
  'packages/shared',
  'packages/core',
  'packages/node',
  'packages/react',
  'packages/vue',
  'packages/angular',
  'packages/ai',
  'packages/cli',
];

console.log('🏗️  Building WhatItBroke monorepo packages in topological order...\n');

for (const pkgRel of BUILD_ORDER) {
  const pkgDir = path.resolve(pkgRel);
  console.log(`Compiling ${pkgRel}...`);
  try {
    execSync('npx tsc', {
      cwd: pkgDir,
      stdio: 'inherit',
    });
    console.log(`✔ Built ${pkgRel}`);
  } catch (err) {
    console.error(`❌ Build failed for ${pkgRel}`);
    process.exit(1);
  }
}

console.log('\n🎉 All WhatItBroke packages compiled successfully!');
