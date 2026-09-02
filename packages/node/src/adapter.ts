/**
 * WhatItBroke - Node.js Adapter
 * Captures uncaught exceptions, unhandled rejections, async contexts,
 * HTTP requests, and database context in Node.js applications.
 */

import {
  DebugAdapter,
  DebugContext,
  EnvironmentContext,
  ErrorInfo,
  ExecutionStep,
  RuntimeContext,
} from '@whatitbroke/shared';
import {
  StackParser,
  SourceMapResolver,
  getGlobalTimeline,
  WhatItBrokeCore,
  getCore,
} from '@whatitbroke/core';
import { HttpTracker } from './http-tracker.js';
import { DbTracker } from './db-tracker.js';

export class NodeAdapter implements DebugAdapter {
  public readonly name = '@whatitbroke/node';
  public readonly framework = 'node' as const;

  private isInstalled = false;
  private core: WhatItBrokeCore;
  private executionSteps: ExecutionStep[] = [];

  constructor(core?: WhatItBrokeCore) {
    this.core = core || getCore();
  }

  public detect(): boolean {
    return (
      typeof process !== 'undefined' &&
      Boolean(process.versions?.node) &&
      !Boolean((globalThis as any).window)
    );
  }

  public addExecutionStep(step: Omit<ExecutionStep, 'id' | 'timestamp'>): void {
    this.executionSteps.push({
      id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      ...step,
    });
  }

  public getRuntimeContext(): RuntimeContext {
    const mem = process.memoryUsage();
    return {
      environment: 'node',
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      uptime: process.uptime(),
      processId: process.pid,
      memoryUsage: {
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        rss: Math.round(mem.rss / 1024 / 1024),
      },
    };
  }

  public captureContext(error: unknown, extras?: Record<string, unknown>): DebugContext {
    const errObj = error instanceof Error ? error : new Error(String(error));
    const stackFrames = StackParser.parse(errObj.stack);
    const primaryFrame = StackParser.getPrimaryFrame(stackFrames);

    const source = primaryFrame
      ? SourceMapResolver.resolveLocation(primaryFrame)
      : {
          file: 'unknown',
          line: 0,
          column: 0,
        };

    const errorInfo: ErrorInfo = {
      name: errObj.name || 'Error',
      message: errObj.message || 'Unknown runtime exception',
      rawStack: errObj.stack,
      timestamp: Date.now(),
    };

    const runtime = this.getRuntimeContext();
    const network = HttpTracker.getContext() || undefined;
    const database = DbTracker.getContext() || undefined;

    const env: EnvironmentContext = {
      nodeEnv: process.env.NODE_ENV,
      cwd: process.cwd(),
      argv: process.argv.slice(2),
    };

    return {
      id: `ctx_${Date.now()}`,
      timestamp: Date.now(),
      error: errorInfo,
      source,
      stack: stackFrames,
      runtime,
      executionPath: [...this.executionSteps],
      timeline: getGlobalTimeline().getEvents(),
      network,
      database,
      framework: {
        name: 'node',
        version: process.version,
      },
      environment: env,
      ...extras,
    };
  }

  /**
   * Installs process-wide handlers for uncaughtException and unhandledRejection
   */
  public installGlobalHandlers(options?: { exitOnError?: boolean; onReport?: (report: any) => void }): void {
    if (this.isInstalled) return;
    this.isInstalled = true;

    process.on('uncaughtException', async (error: Error) => {
      const report = await this.core.analyze(error);
      console.error(this.core.exportReport(report, 'cli'));
      if (options?.onReport) {
        options.onReport(report);
      }
      if (options?.exitOnError !== false) {
        process.exit(1);
      }
    });

    process.on('unhandledRejection', async (reason: unknown) => {
      const err = reason instanceof Error ? reason : new Error(`Unhandled Promise Rejection: ${String(reason)}`);
      const report = await this.core.analyze(err);
      console.error(this.core.exportReport(report, 'cli'));
      if (options?.onReport) {
        options.onReport(report);
      }
    });
  }

  public dispose(): void {
    this.executionSteps = [];
    HttpTracker.clear();
    DbTracker.clear();
  }
}
