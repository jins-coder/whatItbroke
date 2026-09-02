/**
 * WhatItBroke - Node.js HTTP Tracker
 * Intercepts and records incoming and outgoing HTTP events in the execution timeline.
 */

import { NetworkContext } from '@whatitbroke/shared';
import { getGlobalTimeline } from '@whatitbroke/core';

export class HttpTracker {
  private static currentNetworkContext: NetworkContext | null = null;

  public static setContext(context: NetworkContext): void {
    this.currentNetworkContext = context;
  }

  public static getContext(): NetworkContext | null {
    return this.currentNetworkContext;
  }

  public static clear(): void {
    this.currentNetworkContext = null;
  }

  /**
   * Express / Connect compatible middleware to record incoming request context
   */
  public static middleware() {
    return (req: any, res: any, next: (err?: any) => void) => {
      const startTime = Date.now();
      const method = req.method || 'GET';
      const url = req.originalUrl || req.url || '/';
      const route = req.route?.path || url;

      const netContext: NetworkContext = {
        method,
        url,
        route,
        path: req.path || url,
        headers: req.headers || {},
        params: req.params || {},
        query: req.query || {},
        body: req.body,
      };

      HttpTracker.setContext(netContext);
      getGlobalTimeline().recordRequestStart(method, url, { route });

      // Track finish / response
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        netContext.statusCode = res.statusCode;
        netContext.durationMs = duration;
        netContext.failed = res.statusCode >= 400;

        getGlobalTimeline().record('request_end', `Request completed: ${res.statusCode} in ${duration}ms`, {
          status: res.statusCode >= 400 ? 'error' : 'success',
          details: { statusCode: res.statusCode, durationMs: duration },
        });
      });

      next();
    };
  }

  /**
   * Wraps an outbound fetch or API request
   */
  public static async trackOutboundRequest<T>(
    url: string,
    options: { method?: string; body?: unknown } = {},
    fn: () => Promise<T>
  ): Promise<T> {
    const method = options.method || 'GET';
    const timeline = getGlobalTimeline();
    timeline.recordApiRequest(url, method);

    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      timeline.recordApiResponse(url, 200, duration);
      return result;
    } catch (err: any) {
      const duration = Date.now() - start;
      const status = err.status || err.statusCode || 500;
      timeline.recordApiResponse(url, status, duration, { error: err.message });
      throw err;
    }
  }
}
