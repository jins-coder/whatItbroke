/**
 * WhatItBroke - Angular ErrorHandler Provider
 * Implements Angular's ErrorHandler interface to intercept and analyze all uncaught Angular errors.
 */

import { RootCauseReport, formatReportCLI } from '@whatitbroke/shared';
import { ErrorOverlay } from '@whatitbroke/core';
import { AngularAdapter } from './adapter.js';

export interface WhatItBrokeAngularOptions {
  logToConsole?: boolean;
  onError?: (report: RootCauseReport, error: Error) => void;
  overlay?: boolean;
  overlayPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  autoOpenOnCrash?: boolean;
}

export class WhatItBrokeErrorHandler {
  private adapter: AngularAdapter;
  private options?: WhatItBrokeAngularOptions;

  constructor(options?: WhatItBrokeAngularOptions) {
    this.adapter = new AngularAdapter();
    this.options = options;

    if (options?.overlay !== false && typeof window !== 'undefined' && typeof document !== 'undefined') {
      ErrorOverlay.init({
        position: options?.overlayPosition,
        autoOpenOnCrash: options?.autoOpenOnCrash !== false,
      });
    }
  }

  public async handleError(error: any): Promise<void> {
    try {
      const report = await this.adapter.analyzeAngularError(error);

      if (this.options?.logToConsole !== false) {
        console.error(formatReportCLI(report));
      }

      const errObj = error instanceof Error ? error : new Error(String(error));

      if (this.options?.overlay !== false && typeof window !== 'undefined') {
        ErrorOverlay.addReport(report, errObj);
      }

      if (this.options?.onError) {
        this.options.onError(report, errObj);
      }
    } catch (e) {
      console.error('WhatItBroke failed during Angular error handling:', e);
    }
  }
}

/**
 * Modern standalone Angular provider for WhatItBroke
 * Usage in app.config.ts:
 * ```ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [provideWhatItBroke({ overlay: true })]
 * };
 * ```
 */
export function provideWhatItBroke(options?: WhatItBrokeAngularOptions) {
  return [
    {
      provide: 'ErrorHandler',
      useFactory: () => new WhatItBrokeErrorHandler(options),
    },
  ];
}

