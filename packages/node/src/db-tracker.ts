/**
 * WhatItBroke - Node.js Database Tracker
 * Intercepts or instruments database queries to record SQL/NoSQL operations,
 * execution timing, and detects null / empty record returns.
 */

import { DatabaseContext } from '@whatitbroke/shared';
import { getGlobalTimeline } from '@whatitbroke/core';

export class DbTracker {
  private static currentDbContext: DatabaseContext | null = null;

  public static setContext(context: DatabaseContext): void {
    this.currentDbContext = context;
  }

  public static getContext(): DatabaseContext | null {
    return this.currentDbContext;
  }

  public static clear(): void {
    this.currentDbContext = null;
  }

  /**
   * Tracks a database query execution
   */
  public static async trackQuery<T>(
    query: string,
    params: unknown[] = [],
    fn: () => Promise<T>,
    options?: { system?: DatabaseContext['system']; table?: string }
  ): Promise<T> {
    const startTime = Date.now();
    const timeline = getGlobalTimeline();

    try {
      const result = await fn();
      const durationMs = Date.now() - startTime;

      const isNullResult =
        result === null ||
        result === undefined ||
        (Array.isArray(result) && result.length === 0);

      const dbContext: DatabaseContext = {
        system: options?.system || 'generic',
        query,
        parameters: params,
        tableOrCollection: options?.table,
        returnedNull: isNullResult,
        resultCount: Array.isArray(result) ? result.length : result ? 1 : 0,
        executionTimeMs: durationMs,
      };

      DbTracker.setContext(dbContext);
      timeline.recordDbQuery(query, durationMs, isNullResult, dbContext.resultCount);

      return result;
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const dbContext: DatabaseContext = {
        system: options?.system || 'generic',
        query,
        parameters: params,
        executionTimeMs: durationMs,
        errorMessage: err.message,
      };

      DbTracker.setContext(dbContext);
      timeline.record('db_query_end', `Database query failed: ${err.message}`, {
        status: 'error',
        details: { query, error: err.message, durationMs },
      });

      throw err;
    }
  }
}
