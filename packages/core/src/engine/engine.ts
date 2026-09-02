/**
 * WhatItBroke - Core Debug Engine Orchestrator
 * Coordinates adapters, timeline recording, stack/sourcemap resolution,
 * root-cause analysis, and optional AI layer.
 */

import {
  DebugAdapter,
  DebugContext,
  ErrorInfo,
  RedactionConfig,
  RootCauseReport,
  WhatItBrokeConfig,
  formatReportCLI,
  formatTimelineCLI,
  redact,
} from '@whatitbroke/shared';
import { StackParser } from '../stack/parser.js';
import { SourceMapResolver } from '../sourcemap/resolver.js';
import { getGlobalTimeline, TimelineRecorder } from '../timeline/timeline.js';
import { RootCauseEngine } from './root-cause.js';
import { HtmlReporter } from '../reporters/html-reporter.js';

export interface AIAnalyzer {
  analyze(context: DebugContext): Promise<{
    explanation: string;
    confidenceAdjustment?: number;
    additionalFixes?: string[];
  }>;
}

export class WhatItBrokeCore {
  private adapters: Map<string, DebugAdapter> = new Map();
  private timeline: TimelineRecorder;
  private config: WhatItBrokeConfig;
  private aiAnalyzer: AIAnalyzer | null = null;

  constructor(config: WhatItBrokeConfig = {}) {
    this.config = config;
    this.timeline = getGlobalTimeline();
  }

  public registerAdapter(adapter: DebugAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  public getAdapter(name: string): DebugAdapter | undefined {
    return this.adapters.get(name);
  }

  public setAIAnalyzer(analyzer: AIAnalyzer): void {
    this.aiAnalyzer = analyzer;
  }

  public getTimeline(): TimelineRecorder {
    return this.timeline;
  }

  public getConfig(): WhatItBrokeConfig {
    return this.config;
  }

  /**
   * Detects the best matching adapter registered
   */
  public detectActiveAdapter(): DebugAdapter | null {
    for (const adapter of this.adapters.values()) {
      if (adapter.detect()) {
        return adapter;
      }
    }
    return null;
  }

  /**
   * Captures an error and normalizes it into universal DebugContext
   */
  public async capture(error: unknown, extras?: Record<string, unknown>): Promise<DebugContext> {
    const activeAdapter = this.detectActiveAdapter();
    let baseContext: DebugContext;

    if (activeAdapter) {
      baseContext = await activeAdapter.captureContext(error, extras);
    } else {
      baseContext = this.createDefaultContext(error, extras);
    }

    // Attach latest timeline events
    baseContext.timeline = this.timeline.getEvents();

    // Redact sensitive values according to privacy rules
    const redactionConfig: RedactionConfig = {
      keys: this.config.redact,
      patterns: this.config.redactPatterns?.map((p) => new RegExp(p, 'g')),
    };

    const sanitizedContext = redact(baseContext, redactionConfig);

    // Record exception in timeline if not already recorded
    this.timeline.recordException(
      sanitizedContext.error,
      sanitizedContext.source.file,
      sanitizedContext.source.line
    );

    return sanitizedContext;
  }

  /**
   * Analyzes an error or context and returns a complete 4-question RootCauseReport
   */
  public async analyze(errorOrContext: unknown, extras?: Record<string, unknown>): Promise<RootCauseReport> {
    let context: DebugContext;

    if (this.isDebugContext(errorOrContext)) {
      context = errorOrContext;
    } else {
      context = await this.capture(errorOrContext, extras);
    }

    // Run core heuristic root-cause analysis
    const report = RootCauseEngine.analyze(context);

    // Optional AI Layer (Zero-AI-Dependency rule: only invoked if explicitly configured)
    if (this.config.ai?.enabled && this.aiAnalyzer) {
      try {
        const aiResult = await this.aiAnalyzer.analyze(context);
        report.aiEnhanced = true;
        report.aiExplanation = aiResult.explanation;
        if (aiResult.confidenceAdjustment) {
          report.confidenceScore = Math.min(100, Math.max(0, report.confidenceScore + aiResult.confidenceAdjustment));
        }
      } catch (err) {
        // AI failure must never break core analysis
        report.aiExplanation = `AI analyzer unavailable: ${(err as Error).message}`;
      }
    }

    return report;
  }

  /**
   * Exports or prints report according to configuration
   */
  public exportReport(report: RootCauseReport, format: 'cli' | 'json' | 'html' = 'cli'): string {
    switch (format) {
      case 'cli':
        return formatReportCLI(report);
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'html':
        return HtmlReporter.generate(report);
      default:
        return formatReportCLI(report);
    }
  }

  /**
   * Helper to write report to disk
   */
  public async saveReportToFile(report: RootCauseReport, filePath: string): Promise<void> {
    if (typeof process === 'undefined' || !process.versions?.node) {
      throw new Error('saveReportToFile is only supported in Node.js environments.');
    }
    const fs = await import('node:fs');
    const path = await import('node:path');

    const ext = path.extname(filePath).toLowerCase();
    const content = this.exportReport(report, ext === '.html' ? 'html' : ext === '.json' ? 'json' : 'cli');
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  private createDefaultContext(error: unknown, extras?: Record<string, unknown>): DebugContext {
    const errObj = error instanceof Error ? error : new Error(String(error));
    const stackFrames = StackParser.parse(errObj.stack);
    const primaryFrame = StackParser.getPrimaryFrame(stackFrames);

    const source = primaryFrame
      ? SourceMapResolver.resolveLocation(primaryFrame, this.config.projectRoot)
      : {
          file: 'unknown',
          line: 0,
          column: 0,
        };

    const errorInfo: ErrorInfo = {
      name: errObj.name || 'Error',
      message: errObj.message || 'Unknown error occurred',
      rawStack: errObj.stack,
      timestamp: Date.now(),
    };

    return {
      id: `ctx_${Date.now()}`,
      timestamp: Date.now(),
      error: errorInfo,
      source,
      stack: stackFrames,
      runtime: {
        environment: typeof process !== 'undefined' && process.versions?.node ? 'node' : 'browser',
        nodeVersion: typeof process !== 'undefined' ? process.version : undefined,
        platform: typeof process !== 'undefined' ? process.platform : undefined,
      },
      executionPath: [],
      timeline: [],
      framework: {
        name: 'vanilla',
      },
      environment: {
        nodeEnv: typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined,
        cwd: typeof process !== 'undefined' ? process.cwd() : undefined,
      },
      ...extras,
    };
  }

  private isDebugContext(val: unknown): val is DebugContext {
    return (
      typeof val === 'object' &&
      val !== null &&
      'error' in val &&
      'source' in val &&
      'stack' in val
    );
  }
}

// Global Core Singleton
let defaultCoreInstance: WhatItBrokeCore | null = null;

export function getCore(config?: WhatItBrokeConfig): WhatItBrokeCore {
  if (!defaultCoreInstance || config) {
    defaultCoreInstance = new WhatItBrokeCore(config);
  }
  return defaultCoreInstance;
}
