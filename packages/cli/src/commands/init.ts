/**
 * WhatItBroke CLI - `whatitbroke init`
 * Automatically detects project framework and scaffolds configuration.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { colors, DEFAULT_SENSITIVE_KEYS, WhatItBrokeConfig } from '@whatitbroke/shared';

export interface InitOptions {
  cwd?: string;
  force?: boolean;
  dryRun?: boolean;
}

export function runInit(options: InitOptions = {}): WhatItBrokeConfig {
  const cwd = options.cwd || process.cwd();
  const pkgPath = path.join(cwd, 'package.json');
  const c = colors;

  console.log(`${c.bold}${c.cyan}WhatItBroke Initializer${c.reset}`);
  console.log('Detecting project framework and dependencies...\n');

  let detectedFramework: 'node' | 'react' | 'vue' | 'angular' | 'vanilla' = 'node';
  const adapters: string[] = ['@whatitbroke/node'];

  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['@angular/core']) {
        detectedFramework = 'angular';
        adapters.push('@whatitbroke/angular');
        console.log(`  ${c.green}✔ Detected Angular project${c.reset}`);
      } else if (deps['vue'] || deps['nuxt']) {
        detectedFramework = 'vue';
        adapters.push('@whatitbroke/vue');
        console.log(`  ${c.green}✔ Detected Vue project${c.reset}`);
      } else if (deps['react'] || deps['next'] || deps['react-dom']) {
        detectedFramework = 'react';
        adapters.push('@whatitbroke/react');
        console.log(`  ${c.green}✔ Detected React project${c.reset}`);
      } else {
        console.log(`  ${c.green}✔ Detected Node.js / TypeScript project${c.reset}`);
      }
    } catch {
      console.log(`  ${c.yellow}⚠ Could not parse package.json, defaulting to Node.js${c.reset}`);
    }
  } else {
    console.log(`  ${c.yellow}ℹ No package.json found in current directory${c.reset}`);
  }

  const config: WhatItBrokeConfig = {
    framework: detectedFramework,
    adapters,
    redact: DEFAULT_SENSITIVE_KEYS.slice(0, 10),
    sourcemaps: true,
    maxTimelineEvents: 100,
    outputFormat: 'cli',
    outputDirectory: '.whatitbroke',
    ai: {
      enabled: false,
      provider: 'openai',
      model: 'gpt-4o-mini',
    },
  };

  const configPath = path.join(cwd, 'whatitbroke.config.json');

  if (options.dryRun) {
    console.log(`\n${c.bold}Dry-run mode. Scaffolding would write to:${c.reset} ${configPath}`);
    console.log(JSON.stringify(config, null, 2));
    return config;
  }

  if (fs.existsSync(configPath) && !options.force) {
    console.log(`\n${c.yellow}⚠ Configuration file already exists at ${configPath}${c.reset}`);
    console.log(`Use --force to overwrite.`);
    return config;
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  console.log(`\n${c.green}${c.bold}✔ Successfully created whatitbroke.config.json${c.reset}`);
  console.log(`\nRecommended next steps:`);
  console.log(`  1. Run ${c.cyan}npx whatitbroke doctor${c.reset} to verify your environment`);
  console.log(`  2. Import WhatItBroke in your entry point:`);
  if (detectedFramework === 'react') {
    console.log(`     ${c.dim}import { WhatItBrokeBoundary } from '@whatitbroke/react';${c.reset}`);
  } else if (detectedFramework === 'vue') {
    console.log(`     ${c.dim}import { WhatItBrokeVue } from '@whatitbroke/vue';\n     app.use(WhatItBrokeVue);${c.reset}`);
  } else if (detectedFramework === 'angular') {
    console.log(`     ${c.dim}import { WhatItBrokeErrorHandler } from '@whatitbroke/angular';${c.reset}`);
  } else {
    console.log(`     ${c.dim}import { NodeAdapter } from '@whatitbroke/node';\n     new NodeAdapter().installGlobalHandlers();${c.reset}`);
  }

  return config;
}
