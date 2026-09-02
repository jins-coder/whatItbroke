/**
 * WhatItBroke - Vue 3 Plugin
 * Installs WhatItBroke global error handling and component diagnostics into Vue 3 apps.
 */

import type { App, ComponentPublicInstance } from 'vue';
import { RootCauseReport, formatReportCLI } from '@whatitbroke/shared';
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
      });
    }

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

    // 2. Reactivity & Vue Warning Hook (captures Vue warnings before fatal errors)
    if (options?.captureReactivityLoss) {
      app.config.warnHandler = (msg, instance, trace) => {
        // Intercept Vue reactivity warnings (e.g. read-only mutation, missing refs)
        if (msg.includes('target is readonly') || msg.includes('Set operation on key failed') || msg.includes('Avoid mutating a prop')) {
          console.warn(`\x1b[33m\x1b[1m⚠️ WHAT IT BROKE (Reactivity Warning)\x1b[0m\n${msg}\n${trace}`);
          if (enableOverlay) {
            VueErrorOverlay.addWarning(msg, trace);
          }
        }
        if (typeof prevWarnHandler === 'function') {
          prevWarnHandler(msg, instance, trace);
        }
      };
    }
  },
};
