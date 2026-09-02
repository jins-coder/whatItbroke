/**
 * WhatItBroke - Terminal Formatter and ANSI Visualizer
 */

import { RootCauseReport, TimelineEvent } from './types.js';

const isColorSupported = !process.env.NO_COLOR && process.stdout?.isTTY !== false;

export const colors = {
  reset: isColorSupported ? '\x1b[0m' : '',
  bold: isColorSupported ? '\x1b[1m' : '',
  dim: isColorSupported ? '\x1b[2m' : '',
  italic: isColorSupported ? '\x1b[3m' : '',
  underline: isColorSupported ? '\x1b[4m' : '',
  red: isColorSupported ? '\x1b[31m' : '',
  green: isColorSupported ? '\x1b[32m' : '',
  yellow: isColorSupported ? '\x1b[33m' : '',
  blue: isColorSupported ? '\x1b[34m' : '',
  magenta: isColorSupported ? '\x1b[35m' : '',
  cyan: isColorSupported ? '\x1b[36m' : '',
  white: isColorSupported ? '\x1b[37m' : '',
  gray: isColorSupported ? '\x1b[90m' : '',
  bgRed: isColorSupported ? '\x1b[41m' : '',
  bgGreen: isColorSupported ? '\x1b[42m' : '',
  bgYellow: isColorSupported ? '\x1b[43m' : '',
  bgBlue: isColorSupported ? '\x1b[44m' : '',
};

export function formatReportCLI(report: RootCauseReport): string {
  const lines: string[] = [];
  const c = colors;

  lines.push('');
  lines.push(`${c.red}${c.bold}🔴 WHAT IT BROKE${c.reset}`);
  lines.push('');
  lines.push(`${c.bold}${report.context.error.name}: ${report.context.error.message}${c.reset}`);
  lines.push('');

  // Location
  const loc = report.affectedLocation;
  lines.push(`📍 ${c.cyan}${loc.file}:${loc.line}${loc.column ? `:${loc.column}` : ''}${c.reset}`);
  lines.push('');

  // Function or Component if available
  if (loc.functionName) {
    lines.push(`${c.bold}${c.gray}FUNCTION${c.reset}`);
    lines.push(`${c.white}${loc.functionName}${c.reset}`);
    lines.push('');
  } else if (report.context.framework?.component?.name) {
    lines.push(`${c.bold}${c.gray}COMPONENT${c.reset}`);
    lines.push(`${c.white}${report.context.framework.component.name}${c.reset}`);
    lines.push('');
  }

  // Snippet preview if available
  if (loc.snippet && loc.snippet.lines.length > 0) {
    lines.push(`${c.bold}${c.gray}SOURCE SNIPPET${c.reset}`);
    for (const s of loc.snippet.lines) {
      const lineNumStr = String(s.lineNumber).padStart(4, ' ');
      if (s.isErrorLine) {
        lines.push(`${c.red}> ${lineNumStr} | ${s.content}${c.reset}`);
      } else {
        lines.push(`${c.gray}  ${lineNumStr} | ${s.content}${c.reset}`);
      }
    }
    lines.push('');
  }

  // Cause
  lines.push(`${c.bold}${c.gray}CAUSE${c.reset}`);
  lines.push(`${c.yellow}${report.rootCause}${c.reset}`);
  lines.push('');

  // Trigger if present
  if (report.trigger) {
    lines.push(`${c.bold}${c.gray}TRIGGER${c.reset}`);
    lines.push(`${report.trigger}`);
    lines.push('');
  }

  // Execution Path / Render Path
  if (report.executionPath && report.executionPath.length > 0) {
    const isRender = report.context.framework?.name === 'react' || report.context.framework?.name === 'vue';
    lines.push(`${c.bold}${c.gray}${isRender ? 'RENDER PATH' : 'EXECUTION PATH'}${c.reset}`);
    lines.push('');
    for (let i = 0; i < report.executionPath.length; i++) {
      const step = report.executionPath[i];
      const isLast = i === report.executionPath.length - 1;
      const marker = isLast && !step.includes('❌') ? ` ${c.red}❌${c.reset}` : '';
      lines.push(`  ${step}${marker}`);
      if (!isLast) {
        lines.push(`  ${c.dim}↓${c.reset}`);
      }
    }
    lines.push('');
  }

  // Evidence
  if (report.evidence && report.evidence.length > 0) {
    lines.push(`${c.bold}${c.gray}EVIDENCE${c.reset}`);
    for (const ev of report.evidence) {
      lines.push(`  • ${c.dim}${ev}${c.reset}`);
    }
    lines.push('');
  }

  // Suggested Fix
  lines.push(`${c.bold}${c.gray}RECOMMENDED FIX${c.reset}`);
  lines.push(`${c.green}${report.suggestedFix.explanation}${c.reset}`);
  lines.push('');

  if (report.suggestedFix.suggestedPatch) {
    lines.push(`${c.bold}${c.gray}SUGGESTED DIFF${c.reset}`);
    const diffLines = report.suggestedFix.suggestedPatch.split('\n');
    for (const d of diffLines) {
      if (d.startsWith('+')) {
        lines.push(`${c.green}${d}${c.reset}`);
      } else if (d.startsWith('-')) {
        lines.push(`${c.red}${d}${c.reset}`);
      } else if (d.startsWith('@')) {
        lines.push(`${c.cyan}${d}${c.reset}`);
      } else {
        lines.push(`${c.gray}${d}${c.reset}`);
      }
    }
    lines.push('');
  }

  // Possible Side Effects
  if (report.possibleSideEffects && report.possibleSideEffects.length > 0) {
    lines.push(`${c.bold}${c.gray}POSSIBLE SIDE EFFECTS${c.reset}`);
    for (const se of report.possibleSideEffects) {
      lines.push(`  ⚠ ${c.yellow}${se}${c.reset}`);
    }
    lines.push('');
  }

  // Verification Guidance
  if (report.suggestedFix.verificationGuidance) {
    lines.push(`${c.bold}${c.gray}VERIFICATION GUIDANCE${c.reset}`);
    lines.push(`  ${c.cyan}${report.suggestedFix.verificationGuidance}${c.reset}`);
    lines.push('');
  }

  // Confidence
  const conf = report.confidenceScore;
  const confColor = conf >= 85 ? c.green : conf >= 65 ? c.yellow : c.red;
  lines.push(`${c.bold}${c.gray}CONFIDENCE${c.reset}`);
  lines.push(`${confColor}${c.bold}${conf}%${c.reset}`);
  lines.push('');

  // AI note if generated
  if (report.aiEnhanced && report.aiExplanation) {
    lines.push(`${c.magenta}${c.bold}✦ AI INSIGHT${c.reset}`);
    lines.push(`${c.dim}${report.aiExplanation}${c.reset}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function formatTimelineCLI(events: TimelineEvent[]): string {
  const lines: string[] = [];
  const c = colors;
  lines.push(`${c.bold}Debug Timeline (${events.length} events)${c.reset}`);
  lines.push('───────────────────────────────────────────────────────');

  const startTime = events.length > 0 ? events[0].timestamp : 0;

  for (const event of events) {
    const timeOffset = startTime ? `+${(event.timestamp - startTime).toFixed(0).padStart(4, ' ')}ms` : '';
    const timeStr = new Date(event.timestamp).toTimeString().split(' ')[0] + '.' + String(event.timestamp % 1000).padStart(3, '0');
    
    let icon = '•';
    let color = c.gray;
    if (event.type === 'exception') {
      icon = '❌';
      color = c.red;
    } else if (event.type === 'undefined_value_detected') {
      icon = '⚠';
      color = c.yellow;
    } else if (event.type === 'component_render' || event.type === 'state_update') {
      icon = '⚡';
      color = c.cyan;
    } else if (event.type === 'api_request' || event.type === 'api_response') {
      icon = '🌐';
      color = c.blue;
    } else if (event.type === 'db_query_start' || event.type === 'db_query_end') {
      icon = '💾';
      color = c.magenta;
    }

    lines.push(`${c.gray}${timeStr} (${timeOffset})${c.reset}  ${icon} ${color}${event.summary}${c.reset}`);
    if (event.file) {
      lines.push(`             ${c.dim}↳ ${event.file}${event.line ? `:${event.line}` : ''}${c.reset}`);
    }
  }

  return lines.join('\n');
}
