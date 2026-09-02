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

const NEW_VERSION = process.argv[2] || '1.0.3';

console.log(`Preparing release ${NEW_VERSION} across all monorepo packages...\n`);

const rootReadme = fs.existsSync('README.md') ? fs.readFileSync('README.md', 'utf-8') : '';
const rootLicense = fs.existsSync('LICENSE') ? fs.readFileSync('LICENSE', 'utf-8') : '';

// 1. Update root package.json
const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
rootPkg.version = NEW_VERSION;
fs.writeFileSync('package.json', JSON.stringify(rootPkg, null, 2) + '\n');

// 2. Process each package
for (const pkgRel of PACKAGES) {
  const pkgDir = path.resolve(pkgRel);
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));

  pkg.version = NEW_VERSION;

  // Bump internal workspace dependencies
  if (pkg.dependencies) {
    for (const dep of Object.keys(pkg.dependencies)) {
      if (dep.startsWith('@whatitbroke/')) {
        pkg.dependencies[dep] = `^${NEW_VERSION}`;
      }
    }
  }

  // Ensure files array includes README.md and LICENSE
  if (!pkg.files) pkg.files = ['dist'];
  if (!pkg.files.includes('README.md')) pkg.files.push('README.md');
  if (!pkg.files.includes('LICENSE')) pkg.files.push('LICENSE');

  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');

  // Preserve package-specific README if already present; only copy if missing
  if (!fs.existsSync(path.join(pkgDir, 'README.md')) && rootReadme) {
    fs.writeFileSync(path.join(pkgDir, 'README.md'), rootReadme);
  }
  if (!fs.existsSync(path.join(pkgDir, 'LICENSE')) && rootLicense) {
    fs.writeFileSync(path.join(pkgDir, 'LICENSE'), rootLicense);
  }

  console.log(`✔ Updated ${pkg.name}@${NEW_VERSION}`);
}

console.log(`\n🎉 All packages bumped to v${NEW_VERSION}!`);
