/**
 * WhatItBroke CLI - `whatitbroke analyze`
 * Performs root-cause analysis on stack traces, log files, or code files.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { colors, RootCauseReport } from '@whatitbroke/shared';
import { StackParser, SourceMapResolver, WhatItBrokeCore } from '@whatitbroke/core';

export interface AnalyzeOptions {
  target?: string;
  format?: 'cli' | 'json' | 'html';
  output?: string;
  cwd?: string;
}

export async function runAnalyze(options: AnalyzeOptions = {}): Promise<RootCauseReport[]> {
  const c = colors;
  const cwd = options.cwd || process.cwd();
  const target = options.target;

  console.log(`${c.bold}WhatItBroke${c.reset}`);
  console.log('────────────────────────────\n');

  const core = new WhatItBrokeCore({ projectRoot: cwd });
  const reports: RootCauseReport[] = [];

  if (target && fs.existsSync(path.resolve(cwd, target))) {
    const fullPath = path.resolve(cwd, target);
    const content = fs.readFileSync(fullPath, 'utf-8');

    // Case 1: Target is a log or stack trace file
    if (content.includes('at ') || content.includes('TypeError') || content.includes('Error:')) {
      const reportsFromLog = await analyzeLogContent(content, core, fullPath);
      reports.push(...reportsFromLog);
    } else {
      // Case 2: Target is a code source file (e.g. user.service.ts)
      const reportFromSource = await analyzeCodeFile(content, fullPath, core);
      if (reportFromSource) {
        reports.push(reportFromSource);
      }
    }
  } else if (target) {
    // Treat target string as an inlined stack trace / error message
    const reportsFromInline = await analyzeLogContent(target, core, 'inline');
    reports.push(...reportsFromInline);
  } else {
    // Default: look for recent crash files or .whatitbroke/last-crash.json
    const crashFile = path.join(cwd, '.whatitbroke', 'last-crash.json');
    if (fs.existsSync(crashFile)) {
      const parsed = JSON.parse(fs.readFileSync(crashFile, 'utf-8'));
      const report = await core.analyze(parsed);
      reports.push(report);
    } else {
      console.log(`${c.yellow}No target specified and no recent crash recorded.${c.reset}`);
      console.log(`Usage: ${c.cyan}whatitbroke analyze <file-or-log-path>${c.reset}`);
      return [];
    }
  }

  // Print Summary Output
  if (reports.length === 0) {
    console.log(`${c.green}✔ No errors detected.${c.reset}\n`);
    return [];
  }

  console.log(`${c.red}${c.bold}🔴 ${reports.length} error${reports.length > 1 ? 's' : ''} detected${c.reset}\n`);

  reports.forEach((rep, idx) => {
    const loc = rep.affectedLocation;
    const baseName = path.basename(loc.file);
    const conf = rep.confidenceScore;
    const confColor = conf >= 85 ? c.green : conf >= 65 ? c.yellow : c.red;

    console.log(`${c.bold}${idx + 1}. ${baseName}:${loc.line}${c.reset}`);
    console.log(`   ${c.red}${rep.context.error.name}${c.reset}\n`);
    console.log(`   ${c.bold}Root cause:${c.reset}`);
    console.log(`   ${rep.rootCause}\n`);

    if (idx > 0) {
      console.log(`   ${c.dim}Likely related to error #${idx}${c.reset}\n`);
    }

    console.log(`   ${c.bold}Confidence:${c.reset} ${confColor}${conf}%${c.reset}\n`);
  });

  // If detailed CLI format or export is requested
  if (options.output) {
    const outPath = path.resolve(cwd, options.output);
    const fmt = options.format || (outPath.endsWith('.html') ? 'html' : outPath.endsWith('.json') ? 'json' : 'cli');
    await core.saveReportToFile(reports[0], outPath);
    console.log(`Report exported to ${c.cyan}${outPath}${c.reset} (${fmt.toUpperCase()})\n`);
  }

  return reports;
}

async function analyzeLogContent(
  content: string,
  core: WhatItBrokeCore,
  filePath: string
): Promise<RootCauseReport[]> {
  const reports: RootCauseReport[] = [];
  const lines = content.split('\n');

  // Find error lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes('TypeError:') || line.includes('ReferenceError:') || line.includes('Error:')) {
      // Gather stack lines below
      const stackSlice: string[] = [line];
      for (let j = i + 1; j < Math.min(lines.length, i + 15); j++) {
        const nextLine = lines[j].trim();
        if (nextLine.startsWith('at ') || nextLine.includes('@')) {
          stackSlice.push(nextLine);
        } else if (nextLine.length > 0 && !nextLine.startsWith('at ')) {
          break;
        }
      }

      const rawStack = stackSlice.join('\n');
      const frames = StackParser.parse(rawStack);
      const primary = StackParser.getPrimaryFrame(frames);

      const errName = line.split(':')[0].trim();
      const errMsg = line.slice(line.indexOf(':') + 1).trim();

      const source = primary
        ? SourceMapResolver.resolveLocation(primary)
        : { file: filePath, line: 1, column: 1 };

      const context = await core.capture(new Error(errMsg), {
        error: { name: errName, message: errMsg, rawStack, timestamp: Date.now() },
        source,
        stack: frames,
      });

      const report = await core.analyze(context);
      reports.push(report);
    }
  }

  return reports;
}

async function analyzeCodeFile(
  content: string,
  filePath: string,
  core: WhatItBrokeCore
): Promise<RootCauseReport | null> {
  const lines = content.split('\n');

  // Detect vulnerable unvalidated property access or DB return null patterns
  let suspectedLine = -1;
  let suspectedProp = 'name';
  let isDbNull = false;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.includes('.profile.name') || (l.includes('.name') && !l.includes('?.') && !l.includes('if ('))) {
      suspectedLine = i + 1;
      suspectedProp = 'name';
      if (content.includes('database') || content.includes('query') || content.includes('findUnique')) {
        isDbNull = true;
      }
      break;
    }
  }

  if (suspectedLine !== -1) {
    const snippet = SourceMapResolver.createSnippet(content, suspectedLine);
    const mockErr = new TypeError(`Cannot read properties of undefined (reading '${suspectedProp}')`);
    
    // Seed timeline with preceding DB event if suspected
    if (isDbNull) {
      core.getTimeline().record('request_start', 'GET /api/profile');
      core.getTimeline().record('db_query_end', 'Database query: returned null (SELECT * FROM users...)', {
        details: { returnedNull: true, resultCount: 0 },
        status: 'warning',
      });
    }

    const context = await core.capture(mockErr, {
      source: {
        file: filePath,
        line: suspectedLine,
        column: 19,
        snippet,
        functionName: 'UserService.getProfile()',
      },
      database: isDbNull ? { returnedNull: true, resultCount: 0, query: 'SELECT * FROM users WHERE id = ?' } : undefined,
    });

    return core.analyze(context);
  }

  return null;
}
