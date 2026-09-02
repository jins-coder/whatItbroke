/**
 * WhatItBroke - Vue 3 Adapter
 * Captures Vue errors, reactive state, setup/template context, and lifecycle hooks.
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

export interface VueErrorExtras {
  instance?: any;
  info?: string; // Vue error info e.g. "render function", "setup function", "watcher callback"
  componentName?: string;
  props?: Record<string, unknown>;
  state?: Record<string, unknown>;
  captureComponentStack?: boolean;
  captureReactivityLoss?: boolean;
}

export class VueAdapter implements DebugAdapter {
  public readonly name = '@whatitbroke/vue';
  public readonly framework = 'vue' as const;

  private core: WhatItBrokeCore;
  private currentComponentContext?: ComponentContext;

  constructor(core?: WhatItBrokeCore) {
    this.core = core || getCore();
  }

  public detect(): boolean {
    const g = globalThis as any;
    return Boolean(g.__VUE__ || g.__VUE_DEVTOOLS_GLOBAL_HOOK__);
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

  public extractComponentName(instance: any): string {
    if (!instance) return 'VueComponent';
    const rawName =
      instance.$options?.name ||
      instance.type?.name ||
      instance.type?.__name ||
      instance.$vnode?.componentOptions?.tag;

    if (rawName && rawName !== 'Anonymous') return rawName;

    // In Vue 3 <script setup>, component name often derives from file path (__file)
    const filePath = instance.type?.__file;
    if (typeof filePath === 'string') {
      const base = filePath.split(/[/\\]/).pop()?.replace(/\.\w+$/, '');
      if (base) return base;
    }

    return 'AnonymousVueComponent';
  }

  public extractComponentStack(instance: any): string[] {
    if (!instance) return ['VueComponent'];
    const stack: string[] = [];
    const seen = new Set<any>();
    let current = instance;

    while (current && !seen.has(current)) {
      seen.add(current);
      const name = this.extractComponentName(current);
      stack.unshift(name);
      current = current.parent || current.$parent;
    }

    return stack.length > 0 ? stack : ['App', this.extractComponentName(instance)];
  }

  public captureContext(error: unknown, extras?: VueErrorExtras): DebugContext {
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

    const compName = extras?.componentName || this.extractComponentName(extras?.instance);
    const lifecycle = extras?.info?.includes('setup')
      ? 'mount'
      : extras?.info?.includes('render')
      ? 'render'
      : 'update';

    const componentStack = extras?.captureComponentStack !== false
      ? this.extractComponentStack(extras?.instance)
      : [compName];

    const componentCtx: ComponentContext = {
      name: compName,
      props: extras?.props || extras?.instance?.$props,
      state: extras?.state || extras?.instance?.$data || extras?.instance?.setupState,
      renderPath: componentStack,
      lifecyclePhase: lifecycle,
      file: source.file,
      line: source.line,
    };

    this.currentComponentContext = componentCtx;

    const executionPath: ExecutionStep[] = [
      {
        id: `vue_step_0`,
        timestamp: Date.now(),
        category: 'render',
        name: compName,
        description: `Vue Component <${compName}>`,
      },
      {
        id: `vue_step_1`,
        timestamp: Date.now(),
        category: 'hook',
        name: extras?.info || 'Execution',
        description: `Vue lifecycle: ${extras?.info || 'unhandled'}`,
      },
    ];

    const errorInfo: ErrorInfo = {
      name: errObj.name || 'VueError',
      message: errObj.message || 'Unhandled Vue runtime error',
      rawStack: errObj.stack,
      timestamp: Date.now(),
    };

    return {
      id: `ctx_vue_${Date.now()}`,
      timestamp: Date.now(),
      error: errorInfo,
      source,
      stack: stackFrames,
      runtime: this.getRuntimeContext(),
      executionPath,
      timeline: getGlobalTimeline().getEvents(),
      framework: {
        name: 'vue',
        component: componentCtx,
        details: {
          info: extras?.info,
        },
      },
    };
  }

  /**
   * Convenience method matching README documentation
   */
  public async handleVueError(error: unknown, instance?: any, info?: string) {
    return this.analyzeVueError(error, { instance, info });
  }

  public async analyzeVueError(error: unknown, extras?: VueErrorExtras) {
    const context = this.captureContext(error, extras);
    return this.core.analyze(context);
  }
}
