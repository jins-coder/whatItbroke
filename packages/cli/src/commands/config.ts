/**
 * WhatItBroke CLI - `whatitbroke config`
 * Displays and validates the current WhatItBroke configuration.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { colors, DEFAULT_SENSITIVE_KEYS } from '@whatitbroke/shared';

export function runConfig(cwd = process.cwd()): void {
  const c = colors;
  const configPath = path.join(cwd, 'whatitbroke.config.json');

  console.log(`${c.bold}${c.cyan}WhatItBroke Configuration${c.reset}`);
  console.log('────────────────────────────\n');

  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      console.log(`${c.bold}Config file:${c.reset} ${configPath}\n`);
      console.log(JSON.stringify(config, null, 2));
    } catch (e: any) {
      console.log(`${c.red}Error parsing configuration file:${c.reset} ${e.message}`);
    }
  } else {
    console.log(`${c.yellow}No whatitbroke.config.json file found in ${cwd}.${c.reset}`);
    console.log(`Using default built-in configuration:\n`);
    console.log(
      JSON.stringify(
        {
          framework: 'auto',
          adapters: ['@whatitbroke/node'],
          redact: DEFAULT_SENSITIVE_KEYS.slice(0, 8),
          sourcemaps: true,
          maxTimelineEvents: 100,
          ai: { enabled: false },
        },
        null,
        2
      )
    );
  }
  console.log('');
}
