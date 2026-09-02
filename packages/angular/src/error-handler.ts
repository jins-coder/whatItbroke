/**
 * WhatItBroke - Angular ErrorHandler Provider
 * Implements Angular's ErrorHandler interface to intercept and analyze all uncaught Angular errors.
 */

import { RootCauseReport } from '@whatitbroke/shared';
import { AngularAdapter } from './adapter.js';

export interface WhatItBrokeAngularOptions {
  logToConsole?: boolean;
  onError?: (report: RootCauseReport, error: Error) => void;
}

export class WhatItBrokeErrorHandler {
  private adapter: AngularAdapter;
  private options?: WhatItBrokeAngularOptions;

  constructor(options?: WhatItBrokeAngularOptions) {
    this.adapter = new AngularAdapter();
    this.options = options;
  }

  public async handleError(error: any): Promise<void> {
    try {
      const report = await this.adapter.analyzeAngularError(error);

      if (this.options?.logToConsole !== false) {
        console.error(
          `\x1b[31m\x1b[1m🔴 WHAT IT BROKE (Angular)\x1b[0m\n${report.headline}\n📍 ${report.affectedLocation.file}:${report.affectedLocation.line}\n\nCAUSE:\n${report.rootCause}\n\nRECOMMENDED FIX:\n${report.suggestedFix.explanation}`
        );
      }

      if (this.options?.onError) {
        const errObj = error instanceof Error ? error : new Error(String(error));
        this.options.onError(report, errObj);
      }
    } catch (e) {
      console.error('WhatItBroke failed during Angular error handling:', e);
    }
  }
}
