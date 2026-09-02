#!/usr/bin/env node

/**
 * WhatItBroke CLI Executable
 */

import { runInit } from '../dist/commands/init.js';
import { runDoctor } from '../dist/commands/doctor.js';
import { runAnalyze } from '../dist/commands/analyze.js';
import { runReport } from '../dist/commands/report.js';
import { runVerify } from '../dist/commands/verify.js';
import { runConfig } from '../dist/commands/config.js';

const args = process.argv.slice(2);
const command = args[0]?.toLowerCase() || 'help';

async function main() {
  switch (command) {
    case 'init': {
      const force = args.includes('--force');
      const dryRun = args.includes('--dry-run');
      runInit({ force, dryRun });
      break;
    }

    case 'doctor': {
      runDoctor();
      break;
    }

    case 'analyze': {
      const target = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
      const formatArg = args.find((a) => a.startsWith('--format='));
      const format = formatArg ? formatArg.split('=')[1] : undefined;
      const outputArg = args.find((a) => a.startsWith('--output='));
      const output = outputArg ? outputArg.split('=')[1] : undefined;

      await runAnalyze({ target, format, output });
      break;
    }

    case 'report': {
      const formatArg = args.find((a) => a.startsWith('--format='));
      const format = formatArg ? formatArg.split('=')[1] : undefined;
      const outputArg = args.find((a) => a.startsWith('--output='));
      const output = outputArg ? outputArg.split('=')[1] : undefined;

      runReport({ format, output });
      break;
    }

    case 'verify': {
      const targetFile = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
      await runVerify({ targetFile });
      break;
    }

    case 'config': {
      runConfig();
      break;
    }

    case '--version':
    case '-v': {
      console.log('WhatItBroke v1.0.0');
      break;
    }

    case 'help':
    case '--help':
    case '-h':
    default: {
      printHelp();
      break;
    }
  }
}

function printHelp() {
  console.log(`
WhatItBroke — Universal Application Debugger
Usage: whatitbroke <command> [options]

Commands:
  init          Auto-detect framework and configure WhatItBroke
  doctor        Run diagnostics on sourcemaps, Node version, and config
  analyze       Run root-cause analysis on an error log, stack trace, or file
  report        Display or export the latest debugging report
  verify        Verify a proposed fix in an isolated sandbox environment
  config        Inspect current configuration and redaction rules

Options:
  --format=<cli|json|html>   Output format for report/analyze (default: cli)
  --output=<file>            Save report output to specified file
  --force                    Overwrite existing configuration during init
  --dry-run                  Simulate command without writing files
  -v, --version              Show version
  -h, --help                 Show help
`);
}

main().catch((err) => {
  console.error('\nError running WhatItBroke CLI:', err.message);
  process.exit(1);
});
