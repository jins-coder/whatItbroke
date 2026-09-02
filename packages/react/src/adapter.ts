/**
 * WhatItBroke - React Adapter
 * Captures React render errors, component stacks, props/state snapshots, and hook contexts.
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
import { HooksDetector } from './hooks-detector.js';

export interface ReactErrorExtras {
  componentStack?: string;
  componentName?: string;
  props?: Record<string, unknown>;
  state?: Record<string, unknown>;
  lifecyclePhase?: ComponentContext['lifecyclePhase'];
}

export class ReactAdapter implements DebugAdapter {
  public readonly name = '@whatitbroke/react';
  public readonly framework = 'react' as const;

  private core: WhatItBrokeCore;
  private currentComponentContext?: ComponentContext;

  constructor(core?: WhatItBrokeCore) {
    this.core = core || getCore();
  }

  public detect(): boolean {
    const g = globalThis as any;
    return Boolean(
      g.React ||
        g.__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
        (typeof document !== 'undefined' && document.getElementById('root'))
    );
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

  /**
   * Parses React's componentStack string into an array of component names from top to bottom
   */
  public parseComponentStack(componentStack?: string): { renderPath: string[]; primaryComponent: string } {
    if (!componentStack) {
      return { renderPath: ['App', 'Component'], primaryComponent: 'Component' };
    }

    const lines = componentStack.split('\n');
    const components: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      const match = line.match(/^in\s+([A-Za-z0-9_]+)/);
      if (match) {
        components.push(match[1]);
      }
    }

    // In React componentStack, the top line is the crashing leaf component,
    // and subsequent lines are parent components (e.g. leaf -> parent -> root).
    // Reverse it to create chronological root-to-leaf renderPath.
    const reversed = [...components].reverse();
    const primary = components[0] || 'Component';

    return {
      renderPath: reversed.length > 0 ? reversed : [primary],
      primaryComponent: primary,
    };
  }

  public captureContext(error: unknown, extras?: ReactErrorExtras): DebugContext {
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

    const parsedStack = this.parseComponentStack(extras?.componentStack);
    const componentName = extras?.componentName || parsedStack.primaryComponent;

    const componentCtx: ComponentContext = {
      name: componentName,
      props: extras?.props,
      state: extras?.state,
      renderPath: parsedStack.renderPath,
      lifecyclePhase: extras?.lifecyclePhase || 'render',
      file: source.file,
      line: source.line,
    };

    this.currentComponentContext = componentCtx;

    // Check for hook errors
    const hookInfo = HooksDetector.analyze(errObj);
    if (hookInfo.isHookError) {
      getGlobalTimeline().record('undefined_value_detected', `React Hook Error: ${hookInfo.message}`, {
        file: source.file,
        line: source.line,
      });
    }

    const errorInfo: ErrorInfo = {
      name: errObj.name || 'ReactRenderError',
      message: errObj.message || 'React rendering crashed',
      rawStack: errObj.stack,
      timestamp: Date.now(),
    };

    const executionPath: ExecutionStep[] = parsedStack.renderPath.map((comp, idx) => ({
      id: `render_${idx}_${comp}`,
      timestamp: Date.now(),
      category: 'render',
      name: comp,
      description: `Rendered component <${comp} />`,
    }));

    return {
      id: `ctx_react_${Date.now()}`,
      timestamp: Date.now(),
      error: errorInfo,
      source,
      stack: stackFrames,
      runtime: this.getRuntimeContext(),
      executionPath,
      timeline: getGlobalTimeline().getEvents(),
      framework: {
        name: 'react',
        component: componentCtx,
      },
    };
  }

  public async analyzeReactError(error: unknown, extras?: ReactErrorExtras) {
    const context = this.captureContext(error, extras);
    return this.core.analyze(context);
  }
}
