/**
 * WhatItBroke - Automated Monorepo NPM Publisher
 * Publishes all packages to npm in topological dependency order.
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

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log('🚀 WhatItBroke Monorepo NPM Publisher\n');

  // 1. Check npm login
  console.log('Checking npm authentication...');
  try {
    const user = execSync('npm.cmd whoami', { encoding: 'utf-8' }).trim();
    console.log(`✔ Logged in as: ${user}\n`);
  } catch {
    console.error(`\n❌ Error: You are not logged into npm.`);
    console.error(`Please run:`);
    console.error(`  npm login`);
    console.error(`or set the NPM_TOKEN environment variable.\n`);
    if (!isDryRun) {
      process.exit(1);
    }
  }

  // 2. Build
  console.log('Compiling all packages...');
  execSync('npm.cmd run build', { stdio: 'inherit' });

  // 3. Test
  console.log('\nRunning test suite...');
  execSync('npm.cmd test', { stdio: 'inherit' });

  // 4. Publish in dependency order
  console.log('\nPublishing packages in topological order...\n');

  for (const pkgRel of PACKAGES) {
    const pkgDir = path.resolve(pkgRel);
    const pkgJson = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf-8'));
    const pkgName = pkgJson.name;
    const version = pkgJson.version;

    console.log(`\n──────────────────────────────────────────`);
    console.log(`Publishing ${pkgName}@${version}...`);

    const publishCmd = isDryRun
      ? 'npm.cmd publish --access public --dry-run'
      : 'npm.cmd publish --access public';

    try {
      execSync(publishCmd, { cwd: pkgDir, stdio: 'inherit' });
      console.log(`✔ Successfully published ${pkgName}@${version}`);
    } catch (err) {
      console.error(`❌ Failed to publish ${pkgName}:`, err.message);
      if (!isDryRun) {
        process.exit(1);
      }
    }
  }

  console.log('\n🎉 All WhatItBroke packages published successfully to npm!');
  console.log('Users can now install globally with:');
  console.log('  npm install -g whatitbroke');
  console.log('or execute directly with:');
  console.log('  npx whatitbroke');
}

main().catch((err) => {
  console.error('\nPublish script failed:', err.message);
  process.exit(1);
});
