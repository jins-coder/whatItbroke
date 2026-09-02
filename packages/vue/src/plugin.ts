/**
 * WhatItBroke - Vue 3 Plugin
 * Installs WhatItBroke global error handling and component diagnostics into Vue 3 apps.
 */

import { RootCauseReport } from '@whatitbroke/shared';
import { VueAdapter } from './adapter.js';

export interface WhatItBrokeVueOptions {
  logToConsole?: boolean;
  onError?: (report: RootCauseReport, error: Error) => void;
}

export const WhatItBrokeVue = {
  install(app: any, options?: WhatItBrokeVueOptions) {
    const adapter = new VueAdapter();
    const prevHandler = app.config.errorHandler;

    app.config.errorHandler = async (err: unknown, instance: any, info: string) => {
      try {
        const report = await adapter.analyzeVueError(err, {
          instance,
          info,
        });

        if (options?.logToConsole !== false) {
          console.error(
            `\x1b[31m\x1b[1m🔴 WHAT IT BROKE (Vue)\x1b[0m\n${report.headline}\n📍 ${report.affectedLocation.file}:${report.affectedLocation.line}\n\nCAUSE:\n${report.rootCause}\n\nRECOMMENDED FIX:\n${report.suggestedFix.explanation}`
          );
        }

        if (options?.onError) {
          const errObj = err instanceof Error ? err : new Error(String(err));
          options.onError(report, errObj);
        }
      } catch (internalErr) {
        console.error('WhatItBroke failed during Vue error analysis:', internalErr);
      }

      if (typeof prevHandler === 'function') {
        prevHandler(err, instance, info);
      }
    };
  },
};
