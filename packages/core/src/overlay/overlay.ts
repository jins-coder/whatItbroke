/**
 * WhatItBroke - Universal In-Page Error Diagnostics Overlay
 * Zero-configuration floating badge & interactive diagnostic modal for all frameworks
 * (Vue, React, Angular, Vanilla JS).
 *
 * Uses Shadow DOM with :host { all: initial } for strict, zero-bleed CSS isolation:
 * - Won't alter host page styling or layout
 * - Immune to host styles (Tailwind, Bootstrap, CSS resets)
 */

import type { RootCauseReport } from '@whatitbroke/shared';

export interface OverlayOptions {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  autoOpenOnCrash?: boolean;
}

export interface CapturedWarning {
  id: string;
  message: string;
  trace?: string;
  timestamp: number;
}

export class ErrorOverlay {
  private static instance: ErrorOverlay | null = null;
  private hostEl: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private reports: RootCauseReport[] = [];
  private warnings: CapturedWarning[] = [];
  private currentIndex = 0;
  private isOpen = false;
  private options: OverlayOptions;

  private constructor(options?: OverlayOptions) {
    this.options = {
      position: options?.position || 'bottom-right',
      autoOpenOnCrash: options?.autoOpenOnCrash !== false,
    };
    this.mount();
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

  public pushReport(report: RootCauseReport): void {
    this.reports.unshift(report);
    this.currentIndex = 0;
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
    this.render();
  }

  public open(): void {
    this.isOpen = true;
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
    this.currentIndex = 0;
    this.close();
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

    const totalErrors = this.reports.length;
    const totalWarnings = this.warnings.length;
    const activeReport = this.reports[this.currentIndex] || null;
    const pos = this.options.position || 'bottom-right';

    const posRules: Record<string, string> = {
      'bottom-right': 'bottom:24px;right:24px;',
      'bottom-left': 'bottom:24px;left:24px;',
      'top-right': 'top:24px;right:24px;',
      'top-left': 'top:24px;left:24px;',
    };

    const framework = (activeReport?.context.framework?.name || 'app').toUpperCase();

    this.shadow.innerHTML = `
      <style>
        :host { all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color-scheme: dark; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .wib-fab {
          position: fixed; ${posRules[pos] || posRules['bottom-right']} z-index: 2147483647;
          display: flex; align-items: center; gap: 9px; padding: 9px 15px;
          background: rgba(15, 23, 42, 0.9); border: 1px solid ${totalErrors > 0 ? '#f43f5e' : 'rgba(255,255,255,0.15)'};
          border-radius: 9999px; color: #f8fafc; font-size: 13px; font-weight: 600; cursor: pointer;
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          box-shadow: 0 10px 25px rgba(0,0,0,0.5)${totalErrors > 0 ? ', 0 0 14px rgba(244,63,94,0.4)' : ''};
          transition: all 0.2s cubic-bezier(0.16,1,0.3,1); user-select: none;
        }
        .wib-fab:hover { transform: translateY(-2px) scale(1.02); background: rgba(30,41,59,0.95); }
        .wib-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: ${totalErrors > 0 ? '#f43f5e' : '#10b981'};
          box-shadow: 0 0 8px ${totalErrors > 0 ? '#f43f5e' : '#10b981'};
          ${totalErrors > 0 ? 'animation: wib-pulse 1.8s infinite;' : ''}
        }
        @keyframes wib-pulse {
          0%, 100% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        .wib-count {
          padding: 2px 7px; font-size: 11px; font-weight: 700; border-radius: 9999px;
          background: ${totalErrors > 0 ? '#e11d48' : '#334155'}; color: #fff;
        }
        .wib-backdrop {
          position: fixed; inset: 0; background: rgba(3, 7, 18, 0.78); backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px); z-index: 2147483646; display: flex;
          align-items: center; justify-content: center; padding: 20px; animation: wib-fade 0.2s ease-out;
        }
        @keyframes wib-fade { from { opacity: 0; } to { opacity: 1; } }
        .wib-modal {
          width: 100%; max-width: 860px; max-height: 86vh; background: #0b0f19;
          border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; display: flex; flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.85); overflow: hidden; animation: wib-slide 0.2s ease-out;
        }
        @keyframes wib-slide { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .wib-hdr {
          display: flex; align-items: center; justify-content: space-between; padding: 14px 18px;
          background: #111827; border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .wib-title { font-size: 14px; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 8px; }
        .wib-badge {
          background: linear-gradient(135deg, #f43f5e, #be123c); color: #fff; font-size: 10px;
          font-weight: 800; padding: 2px 7px; border-radius: 5px; letter-spacing: 0.04em;
        }
        .wib-btn {
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1;
          padding: 5px 11px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s;
        }
        .wib-btn:hover:not(:disabled) { background: rgba(255,255,255,0.12); color: #fff; }
        .wib-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .wib-close {
          background: transparent; border: none; color: #94a3b8; font-size: 18px; cursor: pointer;
          width: 30px; height: 30px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
        }
        .wib-close:hover { background: rgba(244,63,94,0.15); color: #f43f5e; }
        .wib-body { flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 16px; }
        .wib-card-err {
          background: linear-gradient(180deg, rgba(244,63,94,0.1), rgba(244,63,94,0.02));
          border: 1px solid rgba(244,63,94,0.25); border-radius: 10px; padding: 14px 16px;
        }
        .wib-err-name { font-size: 16px; font-weight: 700; color: #fda4af; font-family: monospace; margin-bottom: 4px; }
        .wib-err-loc { font-size: 12px; color: #38bdf8; font-family: monospace; display: flex; gap: 8px; align-items: center; }
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
        .wib-dump { margin-top: 8px; padding: 8px; background: #030712; border-radius: 6px; color: #94a3b8; font-family: monospace; font-size: 11px; white-space: pre-wrap; max-height: 180px; overflow-y: auto; }
      </style>

      <button class="wib-fab" id="wib-fab" title="WhatItBroke Diagnostic HUD">
        <span class="wib-dot"></span>
        <span>🔴 WhatItBroke</span>
        <span class="wib-count">${totalErrors || (totalWarnings ? `${totalWarnings}w` : '0')}</span>
      </button>

      ${this.isOpen ? `
        <div class="wib-backdrop" id="wib-backdrop">
          <div class="wib-modal">
            <div class="wib-hdr">
              <div style="display:flex;align-items:center;gap:10px;">
                <div class="wib-title"><span>🔴 WHAT IT BROKE</span><span class="wib-badge">${framework}</span></div>
                ${totalErrors > 1 ? `
                  <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#94a3b8;">
                    <button class="wib-btn" id="wib-prev" ${this.currentIndex === 0 ? 'disabled' : ''}>←</button>
                    <span>${this.currentIndex + 1}/${totalErrors}</span>
                    <button class="wib-btn" id="wib-next" ${this.currentIndex >= totalErrors - 1 ? 'disabled' : ''}>→</button>
                  </div>
                ` : ''}
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                ${activeReport ? `<button class="wib-btn" id="wib-copy">📋 Copy Report</button>` : ''}
                ${totalErrors || totalWarnings ? `<button class="wib-btn" id="wib-clear">Clear</button>` : ''}
                <button class="wib-close" id="wib-close">✕</button>
              </div>
            </div>

            <div class="wib-body">
              ${activeReport ? this.renderReport(activeReport) : `
                <div style="text-align:center;padding:40px 20px;color:#94a3b8;">
                  <div style="font-size:32px;margin-bottom:8px;">🟢</div>
                  <h3 style="color:#f8fafc;font-size:15px;margin-bottom:4px;">No Active Errors</h3>
                  <p style="font-size:13px;">WhatItBroke is monitoring runtime error lifecycles.</p>
                </div>
              `}
            </div>
          </div>
        </div>
      ` : ''}
    `;

    this.bindEvents();
  }

  private renderReport(report: RootCauseReport): string {
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

      ${(comp?.state || comp?.props) ? `
        <details style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:9px 12px;">
          <summary style="cursor:pointer;font-size:12px;font-weight:600;color:#cbd5e1;">🔍 Component State & Props Inspector</summary>
          ${comp?.state ? `<div class="wib-dump"><strong style="color:#cbd5e1;">State:</strong>\n${escape(JSON.stringify(comp.state, null, 2))}</div>` : ''}
          ${comp?.props ? `<div class="wib-dump"><strong style="color:#cbd5e1;">Props:</strong>\n${escape(JSON.stringify(comp.props, null, 2))}</div>` : ''}
        </details>
      ` : ''}

      ${this.warnings.length > 0 ? `
        <div>
          <div class="wib-sec-title" style="color:#f59e0b;">⚠️ Intercepted Warnings (${this.warnings.length})</div>
          ${this.warnings.map(w => `
            <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:7px;padding:9px 12px;font-size:12px;color:#fde68a;font-family:monospace;margin-bottom:6px;">
              <div>${escape(w.message)}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  private bindEvents(): void {
    if (!this.shadow) return;

    this.shadow.getElementById('wib-fab')?.addEventListener('click', () => this.toggle());
    this.shadow.getElementById('wib-close')?.addEventListener('click', () => this.close());
    this.shadow.getElementById('wib-backdrop')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'wib-backdrop') this.close();
    });

    this.shadow.getElementById('wib-prev')?.addEventListener('click', () => {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.render();
      }
    });

    this.shadow.getElementById('wib-next')?.addEventListener('click', () => {
      if (this.currentIndex < this.reports.length - 1) {
        this.currentIndex++;
        this.render();
      }
    });

    this.shadow.getElementById('wib-clear')?.addEventListener('click', () => this.clear());

    const copyBtn = this.shadow.getElementById('wib-copy');
    copyBtn?.addEventListener('click', () => {
      const rep = this.reports[this.currentIndex];
      if (rep && typeof navigator !== 'undefined' && navigator.clipboard) {
        const text = `🔴 WHAT IT BROKE REPORT\n` +
          `Error: ${rep.context.error.name}: ${rep.context.error.message}\n` +
          `Location: ${rep.affectedLocation.file}:${rep.affectedLocation.line}\n` +
          `Component: ${rep.context.framework?.component?.renderPath?.join(' > ')}\n` +
          `Root Cause: ${rep.rootCause}\n` +
          `Recommended Fix: ${rep.suggestedFix.explanation}\n`;
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = '✔ Copied!';
          setTimeout(() => { copyBtn.textContent = '📋 Copy Report'; }, 2000);
        });
      }
    });
  }
}

function escape(str: unknown): string {
  if (typeof str !== 'string') return String(str ?? '');
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
