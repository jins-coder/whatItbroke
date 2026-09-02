/**
 * WhatItBroke - Vue 3 Plugin
 * Installs WhatItBroke global error handling and component diagnostics into Vue 3 apps.
 */

import type { App, ComponentPublicInstance } from 'vue';
import { RootCauseReport, formatReportCLI } from '@whatitbroke/shared';
import { getGlobalTimeline } from '@whatitbroke/core';
import { VueAdapter } from './adapter.js';
import { VueErrorOverlay } from './overlay.js';

export interface WhatItBrokeVueOptions {
  logToConsole?: boolean;
  captureReactivityLoss?: boolean;
  captureComponentStack?: boolean;
  onError?: (report: RootCauseReport, error: Error) => void;
  /** Optional custom error handler to chain automatically */
  customErrorHandler?: (err: unknown, instance: ComponentPublicInstance | null, info: string) => void;
  /** Enable in-page floating diagnostics badge & popup (default: true in browser) */
  overlay?: boolean;
  /** Position of the floating badge: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' */
  overlayPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Automatically open diagnostic modal when an error occurs (default: true) */
  autoOpenOnCrash?: boolean;
  /** Automatically intercept unhandled rejections and window exceptions (default: true) */
  autoCaptureGlobalErrors?: boolean;
  /** Automatically monitor browser main-thread long tasks (default: true) */
  autoCapturePerformance?: boolean;
}

export const WhatItBrokeVue = {
  install(app: App, options?: WhatItBrokeVueOptions) {
    const adapter = new VueAdapter();
    const prevErrorHandler = app.config.errorHandler;
    const prevWarnHandler = app.config.warnHandler;

    const enableOverlay = options?.overlay !== false && typeof window !== 'undefined' && typeof document !== 'undefined';
    if (enableOverlay) {
      VueErrorOverlay.init({
        position: options?.overlayPosition,
        autoOpenOnCrash: options?.autoOpenOnCrash !== false,
        autoCaptureGlobalErrors: options?.autoCaptureGlobalErrors !== false,
        autoCapturePerformance: options?.autoCapturePerformance !== false,
      });
    }

    // Record initialization timeline event
    getGlobalTimeline().record('info_log', 'Vue 3 Application Initialized', {
      details: { vueVersion: app.version || '3.x' },
    });

    // 1. Global Vue Error Handler
    app.config.errorHandler = async (err, instance, info) => {
      try {
        const report = await adapter.analyzeVueError(err, {
          instance,
          info,
          captureComponentStack: options?.captureComponentStack ?? true,
          captureReactivityLoss: options?.captureReactivityLoss ?? true,
        });

        if (options?.logToConsole !== false) {
          console.error(formatReportCLI(report));
        }

        const errObj = err instanceof Error ? err : new Error(String(err));

        if (enableOverlay) {
          VueErrorOverlay.addReport(report, errObj);
        }

        if (options?.onError) {
          options.onError(report, errObj);
        }
      } catch (internalErr) {
        console.error('WhatItBroke failed during Vue error analysis:', internalErr);
      }

      // Chain custom handler if provided in options
      if (options?.customErrorHandler) {
        options.customErrorHandler(err, instance, info);
      }

      // Chain previously attached handler
      if (typeof prevErrorHandler === 'function') {
        prevErrorHandler(err, instance, info);
      }
    };

    // 2. Intercept All Vue Warnings (reactivity, props, template mismatches)
    app.config.warnHandler = (msg, instance, trace) => {
      const isReactivity =
        msg.includes('target is readonly') ||
        msg.includes('Set operation on key failed') ||
        msg.includes('Avoid mutating a prop') ||
        msg.includes('toRefs') ||
        msg.includes('toRef');

      if (isReactivity) {
        console.warn(`\x1b[33m\x1b[1m⚠️ WHAT IT BROKE (Reactivity Warning)\x1b[0m\n${msg}\n${trace || ''}`);
      }

      const formattedMsg = isReactivity ? `[Reactivity Loss] ${msg}` : msg;

      if (enableOverlay) {
        VueErrorOverlay.addWarning(formattedMsg, trace);
      }

      getGlobalTimeline().record('warning_log', formattedMsg, {
        details: { component: adapter.extractComponentName(instance) },
      });

      if (typeof prevWarnHandler === 'function') {
        prevWarnHandler(msg, instance, trace);
      }
    };
  },
};
