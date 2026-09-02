/**
 * WhatItBroke - Source Map and Code Snippet Resolver
 * Reconstructs original source files and extracts context snippets.
 */

import { SourceLocation, SourceSnippet, StackFrame } from '@whatitbroke/shared';

declare const require: any;

export interface SourceMapData {
  version: number;
  sources: string[];
  names: string[];
  mappings: string;
  file?: string;
  sourcesContent?: string[];
}

export class SourceMapResolver {
  private static fileCache: Map<string, string> = new Map();
  private static sourceMapCache: Map<string, SourceMapData | null> = new Map();

  /**
   * Set in-memory source content (useful for virtual files or test suites)
   */
  public static setVirtualFile(filePath: string, content: string): void {
    this.fileCache.set(filePath, content);
    this.fileCache.set(filePath.replace(/\\/g, '/'), content);
  }

  /**
   * Resolves source location with snippet and sourcemap mapping if available
   */
  public static resolveLocation(frame: StackFrame, projectRoot?: string): SourceLocation {
    const rawFile = frame.file;
    let resolvedFile = rawFile;

    // Check virtual file cache or read from disk
    const content = this.getFileContent(rawFile, projectRoot);

    if (content) {
      // Check for inline source map: //# sourceMappingURL=data:application/json;base64,...
      const inlineMap = this.extractInlineSourceMap(content);
      if (inlineMap && inlineMap.sourcesContent && inlineMap.sourcesContent.length > 0) {
        // Mapped source is present
        const origFile = inlineMap.sources[0] || rawFile;
        const origContent = inlineMap.sourcesContent[0];
        const snippet = this.createSnippet(origContent, frame.line, frame.column);
        return {
          file: origFile,
          line: frame.line,
          column: frame.column,
          functionName: frame.functionName,
          sourceMapped: true,
          originalFile: origFile,
          originalLine: frame.line,
          originalColumn: frame.column,
          snippet,
        };
      }

      const snippet = this.createSnippet(content, frame.line, frame.column);
      return {
        file: resolvedFile,
        line: frame.line,
        column: frame.column,
        functionName: frame.functionName,
        sourceMapped: false,
        snippet,
      };
    }

    // Fallback if file could not be read
    return {
      file: frame.file,
      line: frame.line,
      column: frame.column,
      functionName: frame.functionName,
      sourceMapped: false,
    };
  }

  /**
   * Reads file content from cache or filesystem safely
   */
  public static getFileContent(filePath: string, projectRoot?: string): string | null {
    const normalized = filePath.replace(/\\/g, '/');
    if (this.fileCache.has(filePath)) return this.fileCache.get(filePath)!;
    if (this.fileCache.has(normalized)) return this.fileCache.get(normalized)!;

    // In browser, skip filesystem lookups cleanly without importing node:fs
    if (typeof window !== 'undefined' || typeof process === 'undefined' || !process.versions?.node) {
      return null;
    }

    try {
      const fsMod = 'node:fs';
      const pathMod = 'node:path';
      const fs = typeof require !== 'undefined' ? require(fsMod) : (process as any).getBuiltinModule?.(fsMod);
      const path = typeof require !== 'undefined' ? require(pathMod) : (process as any).getBuiltinModule?.(pathMod);
      if (!fs || !path) return null;

      const candidates = [
        filePath,
        projectRoot ? path.resolve(projectRoot, filePath) : null,
        projectRoot ? path.resolve(projectRoot, normalized) : null,
      ].filter(Boolean) as string[];

      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          const content = fs.readFileSync(candidate, 'utf-8');
          this.fileCache.set(filePath, content);
          return content;
        }
      }
    } catch {
      // Ignore in browser/bundled runtimes
    }

    return null;
  }

  /**
   * Creates a surrounding source snippet around the target line number
   */
  public static createSnippet(content: string, line: number, column?: number, contextRadius = 3): SourceSnippet {
    const allLines = content.split('\n');
    const startLine = Math.max(1, line - contextRadius);
    const endLine = Math.min(allLines.length, line + contextRadius);

    const snippetLines: { lineNumber: number; content: string; isErrorLine: boolean }[] = [];

    for (let i = startLine; i <= endLine; i++) {
      snippetLines.push({
        lineNumber: i,
        content: allLines[i - 1] ?? '',
        isErrorLine: i === line,
      });
    }

    return {
      lines: snippetLines,
      highlightRange: column ? { startCol: column, endCol: column + 1 } : undefined,
    };
  }

  /**
   * Extracts inline sourcemap if present in file content
   */
  public static extractInlineSourceMap(content: string): SourceMapData | null {
    const marker = '//# sourceMappingURL=data:application/json;base64,';
    const idx = content.lastIndexOf(marker);
    if (idx === -1) return null;

    try {
      const base64Str = content.slice(idx + marker.length).trim();
      const jsonStr = Buffer.from(base64Str, 'base64').toString('utf-8');
      return JSON.parse(jsonStr) as SourceMapData;
    } catch {
      return null;
    }
  }

  public static clearCache(): void {
    this.fileCache.clear();
    this.sourceMapCache.clear();
  }
}
