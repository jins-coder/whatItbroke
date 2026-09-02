/**
 * WhatItBroke - Execution Timeline Recorder
 * Captures chronological events leading up to a failure in a ring buffer.
 */

import { TimelineEvent, TimelineEventType } from '@whatitbroke/shared';

export class TimelineRecorder {
  private events: TimelineEvent[] = [];
  private maxEvents: number;
  private listeners: ((event: TimelineEvent) => void)[] = [];

  constructor(maxEvents = 100) {
    this.maxEvents = maxEvents;
  }

  public onEvent(listener: (event: TimelineEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public record(type: TimelineEventType, summary: string, options?: Partial<TimelineEvent>): TimelineEvent {
    const event: TimelineEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      type,
      summary,
      status: options?.status || (type === 'exception' ? 'error' : type === 'undefined_value_detected' || type === 'performance_issue' ? 'warning' : 'info'),
      ...options,
    };

    this.events.push(event);

    if (this.events.length > this.maxEvents) {
      this.events.shift(); // keep ring buffer bounded
    }

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {}
    }

    return event;
  }

  public recordRequestStart(method: string, url: string, details?: Record<string, unknown>): TimelineEvent {
    return this.record('request_start', `Request started: ${method.toUpperCase()} ${url}`, {
      details: { method, url, ...details },
    });
  }

  public recordApiRequest(url: string, method = 'GET', details?: Record<string, unknown>): TimelineEvent {
    return this.record('api_request', `API request: ${method.toUpperCase()} ${url}`, {
      details: { url, method, ...details },
    });
  }

  public recordApiResponse(url: string, status: number, durationMs?: number, bodySummary?: unknown): TimelineEvent {
    return this.record('api_response', `API response: ${status} (${url})`, {
      details: { url, status, durationMs, bodySummary },
      status: status >= 400 ? 'error' : 'success',
    });
  }

  public recordDbQuery(query: string, durationMs?: number, returnedNull = false, resultCount?: number): TimelineEvent {
    const summary = returnedNull
      ? `Database query: returned null / empty (${query.slice(0, 40)}...)`
      : `Database query (${durationMs ?? 0}ms): ${query.slice(0, 40)}...`;

    return this.record('db_query_end', summary, {
      details: { query, durationMs, returnedNull, resultCount },
      status: returnedNull ? 'warning' : 'info',
    });
  }

  public recordStateUpdate(name: string, prevValue?: unknown, nextValue?: unknown): TimelineEvent {
    return this.record('state_update', `State updated: ${name}`, {
      details: { name, prevValue, nextValue },
    });
  }

  public recordComponentRender(componentName: string, details?: Record<string, unknown>): TimelineEvent {
    return this.record('component_render', `Component rendered: <${componentName} />`, {
      details: { componentName, ...details },
    });
  }

  public recordUndefinedDetected(expression: string, file?: string, line?: number): TimelineEvent {
    return this.record('undefined_value_detected', `Undefined value detected: ${expression}`, {
      file,
      line,
      status: 'warning',
    });
  }

  public recordException(error: Error | { message: string; name?: string }, file?: string, line?: number): TimelineEvent {
    return this.record('exception', `Exception: ${error.name || 'Error'} - ${error.message}`, {
      file,
      line,
      status: 'error',
    });
  }

  public recordBreadcrumb(message: string, details?: Record<string, unknown>): TimelineEvent {
    return this.record('custom_breadcrumb', message, { details });
  }

  public recordPerformance(metric: string, durationMs: number, details?: Record<string, unknown>): TimelineEvent {
    return this.record('performance_issue', `Performance issue: ${metric} took ${durationMs}ms`, {
      details: { metric, durationMs, ...details },
      status: durationMs > 100 ? 'error' : 'warning',
    });
  }

  public getEvents(): TimelineEvent[] {
    return [...this.events];
  }

  public clear(): void {
    this.events = [];
  }
}

let globalTimeline: TimelineRecorder | null = null;

export function getGlobalTimeline(): TimelineRecorder {
  if (!globalTimeline) {
    globalTimeline = new TimelineRecorder();
  }
  return globalTimeline;
}
