/**
 * WhatItBroke CLI - `whatitbroke report`
 * Displays or exports the latest debugging report in CLI, JSON, or HTML.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { colors, RootCauseReport } from '@whatitbroke/shared';
import { HtmlReporter, formatReportCLI } from '@whatitbroke/core';

export interface ReportOptions {
  format?: 'cli' | 'json' | 'html';
  output?: string;
  cwd?: string;
}

export function runReport(options: ReportOptions = {}): string {
  const cwd = options.cwd || process.cwd();
  const reportPath = path.join(cwd, '.whatitbroke', 'last-report.json');
  const c = colors;

  let report: RootCauseReport | null = null;

  if (fs.existsSync(reportPath)) {
    try {
      report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    } catch {
      // ignore
    }
  }

  if (!report) {
    console.log(`${c.yellow}No recent report found in .whatitbroke/last-report.json.${c.reset}`);
    console.log(`Run an analysis first: ${c.cyan}whatitbroke analyze <file>${c.reset}`);
    return '';
  }

  const format = options.format || 'cli';
  let formattedOutput = '';

  if (format === 'html') {
    formattedOutput = HtmlReporter.generate(report);
  } else if (format === 'json') {
    formattedOutput = JSON.stringify(report, null, 2);
  } else {
    formattedOutput = formatReportCLI(report);
  }

  if (options.output) {
    const targetPath = path.resolve(cwd, options.output);
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(targetPath, formattedOutput, 'utf-8');
    console.log(`${c.green}✔ Report saved to ${c.cyan}${targetPath}${c.reset} (${format.toUpperCase()})`);
  } else {
    console.log(formattedOutput);
  }

  return formattedOutput;
}
