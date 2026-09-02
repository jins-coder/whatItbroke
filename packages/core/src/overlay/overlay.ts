/**
 * WhatItBroke - Universal In-Page Real-Time Diagnostic Suite
 * Multi-Category HUD (Errors, Warnings, Performance, Timeline/Profiling, System/Debug)
 *
 * Encapsulated inside Shadow DOM with :host { all: initial } for strict, zero-bleed isolation:
 * - Never distorts host application CSS or layout
 * - Immune to host framework styles (Tailwind, Bootstrap, resets)
 */

import type { RootCauseReport, TimelineEvent } from '@whatitbroke/shared';
import { getGlobalTimeline } from '../timeline/timeline.js';

export interface OverlayOptions {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  autoOpenOnCrash?: boolean;
  autoCaptureGlobalErrors?: boolean;
  autoCapturePerformance?: boolean;
}

export interface CapturedWarning {
  id: string;
  message: string;
  trace?: string;
  timestamp: number;
}

export interface PerformanceIssue {
  id: string;
  type: 'long_task' | 'slow_render' | 'slow_network' | 'memory';
  title: string;
  detail: string;
  durationMs: number;
  timestamp: number;
}

export type OverlayTab = 'errors' | 'warnings' | 'performance' | 'timeline' | 'system';

export class ErrorOverlay {
  private static instance: ErrorOverlay | null = null;
  private hostEl: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;

  private reports: RootCauseReport[] = [];
  private warnings: CapturedWarning[] = [];
  private performanceIssues: PerformanceIssue[] = [];
  private timelineEvents: TimelineEvent[] = [];

  private currentReportIndex = 0;
  private activeTab: OverlayTab = 'errors';
  private isOpen = false;
  private options: OverlayOptions;

  private perfObserver: PerformanceObserver | null = null;

  private constructor(options?: OverlayOptions) {
    this.options = {
      position: options?.position || 'bottom-right',
      autoOpenOnCrash: options?.autoOpenOnCrash !== false,
      autoCaptureGlobalErrors: options?.autoCaptureGlobalErrors !== false,
      autoCapturePerformance: options?.autoCapturePerformance !== false,
    };
    this.mount();
    this.setupAutoCapture();
  }

  public static init(options?: OverlayOptions): ErrorOverlay {
    if (!ErrorOverlay.instance) {
      ErrorOverlay.instance = new ErrorOverlay(options);
    }
    return ErrorOverlay.instance;
  }

  public static getInstance(): ErrorOverlay | null {
    return ErrorOverlay.instance;
  }

  public static addReport(report: RootCauseReport, error?: Error): void {
    (ErrorOverlay.getInstance() || ErrorOverlay.init()).pushReport(report);
  }

  public static addWarning(message: string, trace?: string): void {
    (ErrorOverlay.getInstance() || ErrorOverlay.init()).pushWarning(message, trace);
  }

  public static addPerformance(issue: Omit<PerformanceIssue, 'id' | 'timestamp'>): void {
    (ErrorOverlay.getInstance() || ErrorOverlay.init()).pushPerformance(issue);
  }

  public pushReport(report: RootCauseReport): void {
    this.reports.unshift(report);
    this.currentReportIndex = 0;
    this.activeTab = 'errors';
    this.render();
    if (this.options.autoOpenOnCrash) {
      this.open();
    }
  }

  public pushWarning(message: string, trace?: string): void {
    this.warnings.unshift({
      id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      message,
      trace,
      timestamp: Date.now(),
    });
    if (this.reports.length === 0 && !this.isOpen) {
      this.activeTab = 'warnings';
    }
    this.render();
  }

  public pushPerformance(issue: Omit<PerformanceIssue, 'id' | 'timestamp'>): void {
    this.performanceIssues.unshift({
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      ...issue,
    });
    getGlobalTimeline().recordPerformance(issue.title, issue.durationMs, { detail: issue.detail });
    this.render();
  }

  public open(tab?: OverlayTab): void {
    this.isOpen = true;
    if (tab) {
      this.activeTab = tab;
    } else if (this.reports.length === 0) {
      if (this.performanceIssues.length > 0) this.activeTab = 'performance';
      else if (this.warnings.length > 0) this.activeTab = 'warnings';
      else this.activeTab = 'timeline';
    } else {
      this.activeTab = 'errors';
    }
    this.render();
  }

  public close(): void {
    this.isOpen = false;
    this.render();
  }

  public toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  public clear(): void {
    this.reports = [];
    this.warnings = [];
    this.performanceIssues = [];
    getGlobalTimeline().clear();
    this.timelineEvents = [];
    this.currentReportIndex = 0;
    this.render();
  }

  private setupAutoCapture(): void {
    if (typeof window === 'undefined') return;

    // 1. Subscribe to timeline events
    const timeline = getGlobalTimeline();
    this.timelineEvents = timeline.getEvents();
    timeline.onEvent((event) => {
      this.timelineEvents = timeline.getEvents();
      if (this.isOpen && this.activeTab === 'timeline') {
        this.render();
      }
    });

    // 2. Performance Observer for Long Tasks (>50ms blocking main thread)
    if (this.options.autoCapturePerformance && typeof PerformanceObserver !== 'undefined') {
      try {
        this.perfObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const duration = Math.round(entry.duration);
            if (duration >= 50) {
              this.pushPerformance({
                type: 'long_task',
                title: 'Main Thread Long Task',
                detail: `Browser execution blocked for ${duration}ms (frame budget: 16ms)`,
                durationMs: duration,
              });
            }
          }
        });
        this.perfObserver.observe({ entryTypes: ['longtask'] });
      } catch {}
    }

    // 3. Automatic Global Unhandled Rejection & Error Capture
    if (this.options.autoCaptureGlobalErrors) {
      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        const msg = reason instanceof Error ? reason.message : String(reason || 'Unhandled Promise Rejection');
        const trace = reason instanceof Error ? reason.stack : undefined;
        this.pushWarning(`Unhandled Rejection: ${msg}`, trace);
      });

      window.addEventListener('error', (event) => {
        if (!event.error && event.message) {
          this.pushWarning(`Script Error: ${event.message} (${event.filename}:${event.lineno})`);
        }
      });
    }

    // 4. Real-Time Live Network (fetch) & Latency Tracking
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      const origFetch = window.fetch;
      window.fetch = async (...args) => {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || 'unknown';
        const method = (args[1]?.method || 'GET').toUpperCase();
        const start = performance.now();
        getGlobalTimeline().recordApiRequest(url, method);

        try {
          const res = await origFetch(...args);
          const duration = Math.round(performance.now() - start);
          getGlobalTimeline().recordApiResponse(url, res.status, duration);

          if (duration >= 1000) {
            this.pushPerformance({
              type: 'slow_network',
              title: `Slow API: ${method} ${url.slice(0, 40)}`,
              detail: `Request completed in ${duration}ms (threshold: 1000ms)`,
              durationMs: duration,
            });
          }

          if (res.status >= 400) {
            this.pushWarning(`HTTP ${res.status}: ${method} ${url}`);
          }

          return res;
        } catch (err: any) {
          const duration = Math.round(performance.now() - start);
          getGlobalTimeline().record('exception', `Network Failure: ${method} ${url} - ${err.message || 'Failed to fetch'}`, {
            details: { url, method, duration },
          });
          this.pushWarning(`Network Failure: ${method} ${url} (${err.message || 'Failed to fetch'})`);
          throw err;
        }
      };
    }

    // 5. Real-Time SPA Navigation Tracking
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', () => {
        getGlobalTimeline().record('custom_breadcrumb', `Navigation: ${location.pathname}${location.search}`);
      });
      window.addEventListener('hashchange', () => {
        getGlobalTimeline().record('custom_breadcrumb', `Route Changed: ${location.hash}`);
      });
    }
  }

  private mount(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    document.getElementById('whatitbroke-overlay-root')?.remove();

    this.hostEl = document.createElement('div');
    this.hostEl.id = 'whatitbroke-overlay-root';
    this.hostEl.style.cssText = 'all: initial; position: absolute; z-index: 2147483647;';
    document.body.appendChild(this.hostEl);

    this.shadow = this.hostEl.attachShadow({ mode: 'open' });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        this.toggle();
      }
    });

    this.render();
  }

  private render(): void {
    if (!this.shadow) return;

    const errCount = this.reports.length;
    const warnCount = this.warnings.length;
    const perfCount = this.performanceIssues.length;
    const timelineCount = this.timelineEvents.length;

    const pos = this.options.position || 'bottom-right';
    const posRules: Record<string, string> = {
      'bottom-right': 'bottom:24px;right:24px;',
      'bottom-left': 'bottom:24px;left:24px;',
      'top-right': 'top:24px;right:24px;',
      'top-left': 'top:24px;left:24px;',
    };

    // Badge styling logic
    let badgeColor = '#10b981';
    let badgeBorder = 'rgba(255,255,255,0.15)';
    let badgeCount = '0';

    if (errCount > 0) {
      badgeColor = '#f43f5e';
      badgeBorder = '#f43f5e';
      badgeCount = `${errCount}`;
    } else if (warnCount > 0 || perfCount > 0) {
      badgeColor = '#f59e0b';
      badgeBorder = 'rgba(245,158,11,0.5)';
      badgeCount = `${warnCount + perfCount}`;
    }

    this.shadow.innerHTML = `
      <style>
        :host { all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color-scheme: dark; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .wib-fab {
          position: fixed; ${posRules[pos] || posRules['bottom-right']} z-index: 2147483647;
          width: 48px; height: 48px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(15, 23, 42, 0.94); border: 1px solid ${badgeBorder};
          cursor: pointer; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 10px 25px rgba(0,0,0,0.5), 0 0 16px ${errCount > 0 ? 'rgba(244,63,94,0.45)' : warnCount > 0 || perfCount > 0 ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.2)'};
          transition: all 0.25s cubic-bezier(0.16,1,0.3,1); user-select: none;
        }
        .wib-fab:hover { transform: translateY(-3px) scale(1.06); background: rgba(30,41,59,0.98); }
        .wib-icon {
          width: 24px; height: 24px; fill: none; stroke: ${errCount > 0 ? '#f43f5e' : warnCount > 0 || perfCount > 0 ? '#f59e0b' : '#38bdf8'};
          stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
        }
        .wib-badge {
          position: absolute; top: -5px; right: -5px; min-width: 19px; height: 19px; padding: 0 5px;
          border-radius: 9999px; background: ${errCount > 0 ? '#f43f5e' : warnCount > 0 || perfCount > 0 ? '#f59e0b' : '#10b981'};
          color: ${warnCount > 0 && errCount === 0 ? '#000' : '#fff'}; font-size: 10px; font-weight: 800; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex; align-items: center; justify-content: center; border: 2px solid #0b0f19;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          ${errCount > 0 ? 'animation: wib-pulse 1.8s infinite;' : ''}
        }
        @keyframes wib-pulse { 0%, 100% { transform: scale(0.95); opacity: 0.85; } 50% { transform: scale(1.15); opacity: 1; } }
        .wib-backdrop {
          position: fixed; inset: 0; background: rgba(3, 7, 18, 0.8); backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px); z-index: 2147483646; display: flex;
          align-items: center; justify-content: center; padding: 20px; animation: wib-fade 0.2s ease-out;
        }
        @keyframes wib-fade { from { opacity: 0; } to { opacity: 1; } }
        .wib-modal {
          width: 100%; max-width: 900px; max-height: 88vh; background: #0b0f19;
          border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; display: flex; flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.85); overflow: hidden; animation: wib-slide 0.2s ease-out;
        }
        @keyframes wib-slide { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .wib-hdr {
          display: flex; align-items: center; justify-content: space-between; padding: 12px 18px;
          background: #111827; border-bottom: 1px solid rgba(255,255,255,0.08); flex-wrap: wrap; gap: 10px;
        }
        .wib-tabs { display: flex; align-items: center; gap: 4px; overflow-x: auto; }
        .wib-tab {
          background: transparent; border: none; color: #94a3b8; font-size: 12px; font-weight: 600;
          padding: 6px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px;
          transition: all 0.15s; white-space: nowrap;
        }
        .wib-tab:hover { background: rgba(255,255,255,0.06); color: #f8fafc; }
        .wib-tab.active { background: rgba(255,255,255,0.12); color: #fff; border-bottom: 2px solid #38bdf8; }
        .wib-tab-badge {
          font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 9999px; background: rgba(255,255,255,0.1); color: #cbd5e1;
        }
        .wib-tab.active .wib-tab-badge { background: #38bdf8; color: #0b0f19; }
        .wib-tab-badge.err { background: #f43f5e; color: #fff; }
        .wib-tab-badge.warn { background: #f59e0b; color: #000; }
        .wib-btn {
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1;
          padding: 5px 11px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s;
        }
        .wib-btn:hover:not(:disabled) { background: rgba(255,255,255,0.12); color: #fff; }
        .wib-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .wib-close {
          background: transparent; border: none; color: #94a3b8; font-size: 18px; cursor: pointer;
          width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
        }
        .wib-close:hover { background: rgba(244,63,94,0.15); color: #f43f5e; }
        .wib-body { flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 14px; }
        .wib-card-err {
          background: linear-gradient(180deg, rgba(244,63,94,0.1), rgba(244,63,94,0.02));
          border: 1px solid rgba(244,63,94,0.25); border-radius: 10px; padding: 14px 16px;
        }
        .wib-err-name { font-size: 15px; font-weight: 700; color: #fda4af; font-family: monospace; margin-bottom: 4px; }
        .wib-err-loc { font-size: 12px; color: #38bdf8; font-family: monospace; }
        .wib-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media (max-width: 680px) { .wib-grid { grid-template-columns: 1fr; } }
        .wib-panel { background: #111827; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px; }
        .wib-sec-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .wib-sec-text { font-size: 13px; line-height: 1.55; color: #e2e8f0; }
        .wib-diff { margin-top: 10px; background: #030712; padding: 10px; border-radius: 7px; font-family: monospace; font-size: 12px; line-height: 1.45; overflow-x: auto; }
        .wib-diff-add { color: #34d399; background: rgba(16,185,129,0.14); display: block; padding: 2px 4px; border-radius: 3px; }
        .wib-diff-del { color: #f87171; background: rgba(239,68,68,0.14); display: block; padding: 2px 4px; border-radius: 3px; }
        .wib-trail { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 10px 14px; background: #111827; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; font-size: 12px; color: #cbd5e1; }
        .wib-crumb { background: #1e293b; padding: 3px 8px; border-radius: 5px; font-weight: 600; color: #f8fafc; }
        .wib-crumb.active { background: rgba(244,63,94,0.2); color: #fda4af; border: 1px solid rgba(244,63,94,0.3); }
        .wib-snip { background: #030712; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; font-family: monospace; font-size: 12px; overflow: hidden; }
        .wib-snip-line { display: flex; padding: 3px 10px; line-height: 1.5; }
        .wib-snip-line.err { background: rgba(244,63,94,0.18); border-left: 3px solid #f43f5e; color: #fff; font-weight: 600; }
        .wib-snip-no { width: 36px; color: #64748b; user-select: none; text-align: right; padding-right: 12px; }
        .wib-list-item { background: #111827; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
        .wib-item-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .wib-item-title { font-size: 13px; font-weight: 600; color: #f8fafc; }
        .wib-item-time { font-size: 11px; color: #64748b; font-family: monospace; }
        .wib-item-desc { font-size: 12px; color: #94a3b8; }
        .wib-chip { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; }
        .wib-chip-warn { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }
        .wib-chip-perf { background: rgba(56,189,248,0.15); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3); }
        .wib-chip-err { background: rgba(244,63,94,0.15); color: #f43f5e; border: 1px solid rgba(244,63,94,0.3); }
        .wib-chip-info { background: rgba(148,163,184,0.15); color: #cbd5e1; border: 1px solid rgba(148,163,184,0.3); }
      </style>

      <button class="wib-fab" id="wib-fab" title="WhatItBroke Diagnostics (Click to Inspect &bull; Ctrl+Shift+D)">
        <svg class="wib-icon" viewBox="0 0 24 24">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
        <span class="wib-badge">${badgeCount}</span>
      </button>

      ${this.isOpen ? `
        <div class="wib-backdrop" id="wib-backdrop">
          <div class="wib-modal">
            <div class="wib-hdr">
              <div class="wib-tabs">
                <button class="wib-tab ${this.activeTab === 'errors' ? 'active' : ''}" data-tab="errors">
                  <span>🔴 Errors</span>
                  <span class="wib-tab-badge ${errCount > 0 ? 'err' : ''}">${errCount}</span>
                </button>
                <button class="wib-tab ${this.activeTab === 'warnings' ? 'active' : ''}" data-tab="warnings">
                  <span>⚠️ Warnings</span>
                  <span class="wib-tab-badge ${warnCount > 0 ? 'warn' : ''}">${warnCount}</span>
                </button>
                <button class="wib-tab ${this.activeTab === 'performance' ? 'active' : ''}" data-tab="performance">
                  <span>⚡ Performance</span>
                  <span class="wib-tab-badge">${perfCount}</span>
                </button>
                <button class="wib-tab ${this.activeTab === 'timeline' ? 'active' : ''}" data-tab="timeline">
                  <span>⏱ Timeline</span>
                  <span class="wib-tab-badge">${timelineCount}</span>
                </button>
                <button class="wib-tab ${this.activeTab === 'system' ? 'active' : ''}" data-tab="system">
                  <span>ℹ System</span>
                </button>
              </div>

              <div style="display:flex;align-items:center;gap:8px;">
                ${this.activeTab === 'errors' && errCount > 1 ? `
                  <button class="wib-btn" id="wib-prev" ${this.currentReportIndex === 0 ? 'disabled' : ''}>←</button>
                  <span style="font-size:11px;color:#94a3b8;">${this.currentReportIndex + 1}/${errCount}</span>
                  <button class="wib-btn" id="wib-next" ${this.currentReportIndex >= errCount - 1 ? 'disabled' : ''}>→</button>
                ` : ''}
                <button class="wib-btn" id="wib-clear" title="Clear recorded issues">Clear</button>
                <button class="wib-close" id="wib-close" title="Close (Esc)">✕</button>
              </div>
            </div>

            <div class="wib-body">
              ${this.renderActiveTabContent()}
            </div>
          </div>
        </div>
      ` : ''}
    `;

    this.bindEvents();
  }

  private renderActiveTabContent(): string {
    switch (this.activeTab) {
      case 'errors':
        return this.renderErrorsTab();
      case 'warnings':
        return this.renderWarningsTab();
      case 'performance':
        return this.renderPerformanceTab();
      case 'timeline':
        return this.renderTimelineTab();
      case 'system':
        return this.renderSystemTab();
    }
  }

  private renderErrorsTab(): string {
    if (this.reports.length === 0) {
      return `
        <div style="text-align:center;padding:45px 20px;color:#94a3b8;">
          <div style="font-size:36px;margin-bottom:10px;">🟢</div>
          <h3 style="color:#f8fafc;font-size:16px;margin-bottom:4px;">No Fatal Crashes Detected</h3>
          <p style="font-size:13px;color:#64748b;">Your application is running without unhandled runtime exceptions.</p>
          <div style="margin-top:16px;display:flex;justify-content:center;gap:10px;">
            <button class="wib-btn" data-switch-tab="performance">⚡ View Performance (${this.performanceIssues.length})</button>
            <button class="wib-btn" data-switch-tab="warnings">⚠️ View Warnings (${this.warnings.length})</button>
          </div>
        </div>
      `;
    }

    const report = this.reports[this.currentReportIndex];
    const loc = report.affectedLocation;
    const comp = report.context.framework?.component;
    const path = comp?.renderPath || (comp?.name ? ['App', comp.name] : []);
    const patch = report.suggestedFix.suggestedPatch;
    const snippet = loc.snippet?.lines || [];

    return `
      <div class="wib-card-err">
        <div class="wib-err-name">${escape(report.context.error.name)}: ${escape(report.context.error.message)}</div>
        <div class="wib-err-loc">
          <span>📍 ${escape(loc.file)}:${loc.line}${loc.column ? `:${loc.column}` : ''}</span>
          ${comp?.lifecyclePhase ? `<span>• [${escape(comp.lifecyclePhase)} phase]</span>` : ''}
        </div>
      </div>

      ${path.length > 0 ? `
        <div>
          <div class="wib-sec-title" style="color:#94a3b8;">Component Hierarchy</div>
          <div class="wib-trail">
            ${path.map((item, idx) => `
              ${idx > 0 ? '<span style="color:#64748b;">❯</span>' : ''}
              <span class="wib-crumb ${idx === path.length - 1 ? 'active' : ''}">${escape(item)}</span>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="wib-grid">
        <div class="wib-panel" style="border-left:3px solid #f59e0b;">
          <div class="wib-sec-title" style="color:#f59e0b;">🔍 Why It Broke (Root Cause)</div>
          <div class="wib-sec-text">${escape(report.rootCause)}</div>
        </div>

        <div class="wib-panel" style="border-left:3px solid #10b981;">
          <div class="wib-sec-title" style="color:#10b981;">💡 Recommended Fix</div>
          <div class="wib-sec-text">${escape(report.suggestedFix.explanation)}</div>
          ${patch ? `
            <div class="wib-diff">
              ${patch.split('\n').map(l => {
                if (l.startsWith('+')) return `<span class="wib-diff-add">${escape(l)}</span>`;
                if (l.startsWith('-')) return `<span class="wib-diff-del">${escape(l)}</span>`;
                return `<span>${escape(l)}</span>`;
              }).join('\n')}
            </div>
          ` : ''}
        </div>
      </div>

      ${snippet.length > 0 ? `
        <div>
          <div class="wib-sec-title" style="color:#94a3b8;">Source Code Snippet</div>
          <div class="wib-snip">
            ${snippet.map(l => `
              <div class="wib-snip-line ${l.isErrorLine ? 'err' : ''}">
                <span class="wib-snip-no">${l.lineNumber}</span>
                <span style="white-space:pre;flex:1;">${escape(l.content)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${comp && (comp.props || comp.state) ? `
        <div>
          <div class="wib-sec-title" style="color:#94a3b8;">Component State & Props</div>
          <div class="wib-snip" style="padding:10px 14px;line-height:1.45;">
            ${comp.props ? `<div style="color:#38bdf8;font-size:11px;font-weight:600;margin-bottom:4px;">// Props</div><pre style="color:#e2e8f0;font-size:11px;margin-bottom:8px;overflow-x:auto;">${escape(safeStringify(comp.props))}</pre>` : ''}
            ${comp.state ? `<div style="color:#34d399;font-size:11px;font-weight:600;margin-bottom:4px;">// State</div><pre style="color:#e2e8f0;font-size:11px;overflow-x:auto;">${escape(safeStringify(comp.state))}</pre>` : ''}
          </div>
        </div>
      ` : ''}
    `;
  }

  private renderWarningsTab(): string {
    if (this.warnings.length === 0) {
      return `
        <div style="text-align:center;padding:45px 20px;color:#94a3b8;">
          <div style="font-size:36px;margin-bottom:10px;">✨</div>
          <h3 style="color:#f8fafc;font-size:16px;margin-bottom:4px;">No Warnings Recorded</h3>
          <p style="font-size:13px;color:#64748b;">Vue reactivity losses, prop mutations, and unhandled warnings are clear.</p>
        </div>
      `;
    }

    return `
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${this.warnings.map(w => `
          <div class="wib-list-item" style="border-left:3px solid #f59e0b;">
            <div class="wib-item-header">
              <span class="wib-chip wib-chip-warn">Warning</span>
              <span class="wib-item-time">${new Date(w.timestamp).toLocaleTimeString()}</span>
            </div>
            <div style="color:#fde68a;font-family:monospace;font-size:12px;line-height:1.4;">${escape(w.message)}</div>
            ${w.trace ? `<div style="font-size:11px;color:#94a3b8;font-family:monospace;white-space:pre-wrap;max-height:100px;overflow-y:auto;margin-top:4px;">${escape(w.trace)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderPerformanceTab(): string {
    if (this.performanceIssues.length === 0) {
      return `
        <div style="text-align:center;padding:45px 20px;color:#94a3b8;">
          <div style="font-size:36px;margin-bottom:10px;">⚡</div>
          <h3 style="color:#f8fafc;font-size:16px;margin-bottom:4px;">Optimal UI Performance</h3>
          <p style="font-size:13px;color:#64748b;">No main-thread blocking tasks (>50ms) or slow renders detected.</p>
        </div>
      `;
    }

    return `
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${this.performanceIssues.map(p => `
          <div class="wib-list-item" style="border-left:3px solid #38bdf8;">
            <div class="wib-item-header">
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="wib-chip wib-chip-perf">${escape(p.type.replace('_', ' '))}</span>
                <span class="wib-item-title">${escape(p.title)}</span>
              </div>
              <span style="font-weight:700;color:#38bdf8;font-size:12px;">${p.durationMs}ms</span>
            </div>
            <div class="wib-item-desc">${escape(p.detail)}</div>
            <div class="wib-item-time" style="margin-top:2px;">Logged at ${new Date(p.timestamp).toLocaleTimeString()}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderTimelineTab(): string {
    if (this.timelineEvents.length === 0) {
      return `
        <div style="text-align:center;padding:45px 20px;color:#94a3b8;">
          <div style="font-size:36px;margin-bottom:10px;">⏱</div>
          <h3 style="color:#f8fafc;font-size:16px;margin-bottom:4px;">Timeline Buffer Initializing</h3>
          <p style="font-size:13px;color:#64748b;">Execution events, lifecycle steps, and network events will stream here.</p>
        </div>
      `;
    }

    return `
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${this.timelineEvents.slice(-30).reverse().map(e => `
          <div class="wib-list-item">
            <div class="wib-item-header">
              <div style="display:flex;align-items:center;gap:6px;">
                <span class="wib-chip ${e.status === 'error' ? 'wib-chip-err' : e.status === 'warning' ? 'wib-chip-warn' : 'wib-chip-info'}">
                  ${escape(e.type)}
                </span>
                <span style="font-size:12px;color:#e2e8f0;font-weight:500;">${escape(e.summary)}</span>
              </div>
              <span class="wib-item-time">${new Date(e.timestamp).toLocaleTimeString()}</span>
            </div>
            ${e.details ? `<div style="font-size:11px;color:#64748b;font-family:monospace;margin-top:2px;">${escape(safeStringify(e.details))}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderSystemTab(): string {
    const memory = typeof performance !== 'undefined' && (performance as any).memory
      ? `${Math.round((performance as any).memory.usedJSHeapSize / 1048576)} MB / ${Math.round((performance as any).memory.totalJSHeapSize / 1048576)} MB`
      : 'Standard Browser Heap';

    const frameworkName = (typeof window !== 'undefined' && (window as any).__VUE__ ? 'Vue 3' : 'Browser Application');

    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="wib-panel">
          <div class="wib-sec-title" style="color:#38bdf8;">Environment & Framework</div>
          <div style="font-size:13px;color:#f8fafc;line-height:1.6;">
            <div><strong>Runtime:</strong> Browser Client (ESM)</div>
            <div><strong>Framework:</strong> ${frameworkName}</div>
            <div><strong>URL:</strong> ${typeof location !== 'undefined' ? escape(location.pathname) : '/'}</div>
          </div>
        </div>

        <div class="wib-panel">
          <div class="wib-sec-title" style="color:#10b981;">Client Telemetry</div>
          <div style="font-size:13px;color:#f8fafc;line-height:1.6;">
            <div><strong>JS Heap Memory:</strong> ${memory}</div>
            <div><strong>Viewport:</strong> ${typeof window !== 'undefined' ? `${window.innerWidth} x ${window.innerHeight}` : 'N/A'}</div>
            <div><strong>Platform:</strong> ${typeof navigator !== 'undefined' ? escape(navigator.platform) : 'Web'}</div>
          </div>
        </div>

        <div class="wib-panel" style="grid-column:1 / -1;">
          <div class="wib-sec-title" style="color:#94a3b8;">WhatItBroke Engine</div>
          <div style="font-size:12px;color:#94a3b8;line-height:1.6;">
            Active ring buffer limit: 100 events &bull; Auto-capture: Active &bull; Shadow DOM Isolation: Enabled &bull; Keyboard Shortcut: <kbd style="background:#1e293b;padding:2px 6px;border-radius:4px;color:#f8fafc;">Ctrl + Shift + D</kbd>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    if (!this.shadow) return;

    this.shadow.getElementById('wib-fab')?.addEventListener('click', () => this.toggle());
    this.shadow.getElementById('wib-close')?.addEventListener('click', () => this.close());
    this.shadow.getElementById('wib-backdrop')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'wib-backdrop') this.close();
    });

    // Tab switching
    this.shadow.querySelectorAll<HTMLButtonElement>('.wib-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab') as OverlayTab;
        if (tab) {
          this.activeTab = tab;
          this.render();
        }
      });
    });

    // Switch tab buttons inside empty states
    this.shadow.querySelectorAll<HTMLButtonElement>('[data-switch-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-switch-tab') as OverlayTab;
        if (tab) {
          this.activeTab = tab;
          this.render();
        }
      });
    });

    // Navigation for reports
    this.shadow.getElementById('wib-prev')?.addEventListener('click', () => {
      if (this.currentReportIndex > 0) {
        this.currentReportIndex--;
        this.render();
      }
    });

    this.shadow.getElementById('wib-next')?.addEventListener('click', () => {
      if (this.currentReportIndex < this.reports.length - 1) {
        this.currentReportIndex++;
        this.render();
      }
    });

    this.shadow.getElementById('wib-clear')?.addEventListener('click', () => this.clear());
  }
}

function escape(str: unknown): string {
  if (typeof str !== 'string') return String(str ?? '');
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function safeStringify(val: unknown): string {
  if (val === null || val === undefined) return String(val);
  if (typeof val !== 'object') return String(val);

  const seen = new WeakSet();
  try {
    return JSON.stringify(
      val,
      (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      },
      2
    );
  } catch {
    return String(val);
  }
}
