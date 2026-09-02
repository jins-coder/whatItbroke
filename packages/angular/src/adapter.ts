/**
 * WhatItBroke - Angular Adapter
 * Captures Angular dependency injection failures, zone context, change-detection errors, and RxJS issues.
 */

import {
  ComponentContext,
  DebugAdapter,
  DebugContext,
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
import { DIAnalyzer } from './di-analyzer.js';

export interface AngularErrorExtras {
  componentName?: string;
  injectorPath?: string[];
  zoneName?: string;
  props?: Record<string, unknown>;
}

export class AngularAdapter implements DebugAdapter {
  public readonly name = '@whatitbroke/angular';
  public readonly framework = 'angular' as const;

  private core: WhatItBrokeCore;
  private currentComponentContext?: ComponentContext;

  constructor(core?: WhatItBrokeCore) {
    this.core = core || getCore();
  }

  public detect(): boolean {
    const g = globalThis as any;
    return Boolean(g.ng || g.getAllAngularRootElements || g.Zone);
  }

  public getComponentContext(): ComponentContext | undefined {
    return this.currentComponentContext;
  }

  public getRuntimeContext(): RuntimeContext {
    return {
      environment: 'browser',
      platform: typeof navigator !== 'undefined' ? navigator.platform : undefined,
    };
  }

  public captureContext(error: unknown, extras?: AngularErrorExtras): DebugContext {
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

    const compName = extras?.componentName || 'AngularComponent';
    const diAnalysis = DIAnalyzer.analyze(errObj);

    const componentCtx: ComponentContext = {
      name: compName,
      props: extras?.props,
      renderPath: ['AppModule', compName],
      lifecyclePhase: 'render',
      file: source.file,
      line: source.line,
    };

    this.currentComponentContext = componentCtx;

    // Execution path
    const executionPath: ExecutionStep[] = [];
    if (diAnalysis.isDIError && diAnalysis.injectorPath) {
      for (const seg of diAnalysis.injectorPath) {
        executionPath.push({
          id: `di_${seg}`,
          timestamp: Date.now(),
          category: 'service',
          name: seg,
          description: `Resolve injector token ${seg}`,
        });
      }
    } else {
      executionPath.push({
        id: `ng_0`,
        timestamp: Date.now(),
        category: 'render',
        name: compName,
        description: `Component <${compName}>`,
      });
    }

    const errorInfo: ErrorInfo = {
      name: errObj.name || 'AngularError',
      message: errObj.message || 'Unhandled Angular runtime error',
      rawStack: errObj.stack,
      timestamp: Date.now(),
    };

    return {
      id: `ctx_angular_${Date.now()}`,
      timestamp: Date.now(),
      error: errorInfo,
      source,
      stack: stackFrames,
      runtime: this.getRuntimeContext(),
      executionPath,
      timeline: getGlobalTimeline().getEvents(),
      framework: {
        name: 'angular',
        component: componentCtx,
        details: {
          diAnalysis,
          zone: extras?.zoneName,
        },
      },
    };
  }

  public async analyzeAngularError(error: unknown, extras?: AngularErrorExtras) {
    const context = this.captureContext(error, extras);
    return this.core.analyze(context);
  }
}
