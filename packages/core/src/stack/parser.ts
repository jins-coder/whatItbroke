/**
 * WhatItBroke - Universal Stack Trace Parser
 * Parses V8 (Chrome, Node), Gecko (Firefox), and WebKit (Safari) stack frames.
 */

import { StackFrame } from '@whatitbroke/shared';

// Match V8 style: at [async] [ClassName.method] (path:line:col) or at path:line:col
const V8_REGEX = /^\s*at\s+(?:(async\s+)?(?:new\s+)?([^\s(]+)\s+)?\(?(.*?):(\d+):(\d+)\)?$/;

// Match V8 style without parens: at /path/to/file.ts:10:5
const V8_NO_PARENS_REGEX = /^\s*at\s+(.*?):(\d+):(\d+)$/;

// Match Gecko / WebKit style: functionName@path/to/file.js:line:col
const GECKO_REGEX = /^(?:([^@]*)@)?(.*?):(\d+):(\d+)$/;

export class StackParser {
  public static parse(stackString: string | undefined): StackFrame[] {
    if (!stackString || typeof stackString !== 'string') {
      return [];
    }

    const lines = stackString.split('\n');
    const frames: StackFrame[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Skip initial error message line if present
      if (line.includes(': ') && !line.startsWith('at ') && !line.includes('@')) {
        continue;
      }

      const frame = this.parseLine(line);
      if (frame) {
        frames.push(frame);
      }
    }

    return frames;
  }

  public static parseLine(line: string): StackFrame | null {
    // 1. Try V8 with parens: at foo (/path/to/file:10:20)
    let match = line.match(V8_REGEX);
    if (match) {
      const isAsync = Boolean(match[1]);
      const rawFn = match[2];
      const fnName = rawFn ? (isAsync ? `async ${rawFn}` : rawFn) : '<anonymous>';
      const file = match[3];
      const lineNum = parseInt(match[4], 10);
      const colNum = parseInt(match[5], 10);

      return this.createFrame(file, lineNum, colNum, fnName);
    }

    // 2. Try V8 without parens: at /path/to/file:10:20
    match = line.match(V8_NO_PARENS_REGEX);
    if (match) {
      const file = match[1];
      const lineNum = parseInt(match[2], 10);
      const colNum = parseInt(match[3], 10);
      return this.createFrame(file, lineNum, colNum, '<anonymous>');
    }

    // 3. Try Gecko / WebKit: foo@/path/to/file:10:20
    match = line.match(GECKO_REGEX);
    if (match) {
      const fnName = match[1] || '<anonymous>';
      const file = match[2];
      const lineNum = parseInt(match[3], 10);
      const colNum = parseInt(match[4], 10);
      return this.createFrame(file, lineNum, colNum, fnName);
    }

    return null;
  }

  private static createFrame(file: string, line: number, column: number, functionName: string): StackFrame {
    // Clean up file if wrapped in parens or file:// prefix
    let cleanFile = file.replace(/^file:\/\//, '');
    
    // Check flags
    const isNative = cleanFile.includes('native') || cleanFile === '<anonymous>';
    const isNodeModules = cleanFile.includes('node_modules');
    const isNodeInternal = cleanFile.startsWith('node:') || cleanFile.includes('node:internal');
    const isFrameworkInternal =
      isNodeInternal ||
      (isNodeModules &&
        (cleanFile.includes('/react/') ||
          cleanFile.includes('/react-dom/') ||
          cleanFile.includes('/@vue/') ||
          cleanFile.includes('/@angular/') ||
          cleanFile.includes('/express/')));

    return {
      file: cleanFile,
      line,
      column,
      functionName: functionName || '<anonymous>',
      isNative,
      isNodeModules,
      isFrameworkInternal,
    };
  }

  /**
   * Returns the primary application frame (skipping framework and node_modules internals when possible)
   */
  public static getPrimaryFrame(frames: StackFrame[]): StackFrame | null {
    if (frames.length === 0) return null;

    // Prefer first user-code frame (not node_modules or native)
    const userFrame = frames.find((f) => !f.isNodeModules && !f.isNative && !f.isFrameworkInternal);
    if (userFrame) {
      return userFrame;
    }

    // Otherwise return the topmost frame
    return frames[0];
  }
}
