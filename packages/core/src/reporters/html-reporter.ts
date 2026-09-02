/**
 * WhatItBroke - Standalone HTML Dashboard Reporter
 * Generates an interactive, dark-mode, zero-dependency HTML dashboard for debug reports.
 */

import { RootCauseReport } from '@whatitbroke/shared';

export class HtmlReporter {
  public static generate(report: RootCauseReport): string {
    const error = report.context.error;
    const loc = report.affectedLocation;
    const conf = report.confidenceScore;
    const confColor = conf >= 85 ? '#10b981' : conf >= 65 ? '#f59e0b' : '#ef4444';
    const jsonContext = JSON.stringify(report, null, 2);

    const timelineRows = report.timeline.map((e, idx) => {
      const timeStr = new Date(e.timestamp).toTimeString().split(' ')[0] + '.' + String(e.timestamp % 1000).padStart(3, '0');
      const badgeClass = e.type === 'exception' ? 'badge-error' : e.type === 'undefined_value_detected' ? 'badge-warn' : 'badge-info';
      return `
        <tr class="${idx === report.timeline.length - 1 ? 'row-active' : ''}">
          <td class="time-col">${timeStr}</td>
          <td><span class="badge ${badgeClass}">${e.type}</span></td>
          <td class="summary-col">${escapeHtml(e.summary)}</td>
          <td class="file-col">${e.file ? escapeHtml(e.file) + (e.line ? `:${e.line}` : '') : '—'}</td>
        </tr>
      `;
    }).join('\n');

    const sourceSnippetRows = loc.snippet?.lines.map((l) => {
      const isErr = l.isErrorLine;
      return `
        <div class="code-line ${isErr ? 'code-error' : ''}">
          <span class="line-no">${l.lineNumber}</span>
          <span class="line-content">${escapeHtml(l.content)}</span>
          ${isErr ? '<span class="error-marker">❌ Exception Trigger</span>' : ''}
        </div>
      `;
    }).join('\n') || '<div class="empty-state">Source snippet not available</div>';

    const execPathItems = report.executionPath.map((step, idx) => {
      const isLast = idx === report.executionPath.length - 1;
      return `
        <div class="step-item ${isLast ? 'step-last' : ''}">
          <div class="step-marker">${isLast ? '❌' : '↓'}</div>
          <div class="step-text">${escapeHtml(step)}</div>
        </div>
      `;
    }).join('\n');

    const diffHtml = report.suggestedFix.suggestedPatch
      ? report.suggestedFix.suggestedPatch.split('\n').map((line) => {
          let cls = 'diff-ctx';
          if (line.startsWith('+')) cls = 'diff-add';
          else if (line.startsWith('-')) cls = 'diff-del';
          else if (line.startsWith('@')) cls = 'diff-meta';
          return `<div class="diff-line ${cls}">${escapeHtml(line)}</div>`;
        }).join('\n')
      : '<div class="empty-state">No diff generated</div>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WhatItBroke Report — ${escapeHtml(error.name)}</title>
  <style>
    :root {
      --bg-dark: #0a0e17;
      --card-bg: #111827;
      --card-border: #1f293d;
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --accent-red: #ef4444;
      --accent-green: #10b981;
      --accent-blue: #3b82f6;
      --accent-yellow: #f59e0b;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg-dark);
      color: var(--text-main);
      font-family: var(--font-sans);
      line-height: 1.5;
      padding: 24px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-badge {
      background: linear-gradient(135deg, #ef4444, #b91c1c);
      color: white;
      font-weight: 800;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 1.1rem;
      letter-spacing: 0.5px;
    }
    .title-group h1 {
      font-size: 1.4rem;
      font-weight: 700;
    }
    .title-group p {
      color: var(--text-muted);
      font-size: 0.85rem;
    }
    .conf-badge {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--card-border);
      padding: 8px 16px;
      border-radius: 8px;
    }
    .conf-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      color: var(--text-muted);
    }
    .conf-value {
      font-size: 1.4rem;
      font-weight: 800;
      color: ${confColor};
    }
    .grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .card-title {
      font-size: 0.95rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      font-weight: 700;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .loc-banner {
      background: #1e1b4b;
      border-left: 4px solid var(--accent-blue);
      padding: 12px 16px;
      border-radius: 6px;
      font-family: var(--font-mono);
      font-size: 0.95rem;
      margin-bottom: 16px;
      color: #93c5fd;
    }
    .cause-box {
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.3);
      padding: 16px;
      border-radius: 8px;
      color: #fde68a;
      font-size: 1.05rem;
      font-weight: 500;
      margin-bottom: 16px;
    }
    .fix-box {
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 16px;
      border-radius: 8px;
      color: #a7f3d0;
      margin-bottom: 16px;
    }
    .fix-box h3 {
      font-size: 1rem;
      margin-bottom: 6px;
      color: #34d399;
    }
    /* Snippet Box */
    .snippet-viewer {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 8px;
      overflow: hidden;
      font-family: var(--font-mono);
      font-size: 0.88rem;
    }
    .code-line {
      display: flex;
      padding: 4px 12px;
      border-left: 3px solid transparent;
    }
    .code-error {
      background: rgba(239, 68, 68, 0.15);
      border-left-color: var(--accent-red);
    }
    .line-no {
      color: #6e7681;
      width: 45px;
      user-select: none;
    }
    .line-content {
      flex: 1;
      white-space: pre-wrap;
    }
    .error-marker {
      color: var(--accent-red);
      font-weight: bold;
      font-size: 0.8rem;
      margin-left: 12px;
    }
    /* Diff View */
    .diff-viewer {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 8px;
      font-family: var(--font-mono);
      font-size: 0.88rem;
      overflow-x: auto;
      padding: 8px 0;
    }
    .diff-line { padding: 2px 14px; white-space: pre-wrap; }
    .diff-add { background: rgba(16, 185, 129, 0.18); color: #6ee7b7; }
    .diff-del { background: rgba(239, 68, 68, 0.18); color: #fca5a5; }
    .diff-meta { color: #60a5fa; }
    .diff-ctx { color: #8b949e; }
    /* Timeline Table */
    .timeline-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    .timeline-table th {
      text-align: left;
      padding: 8px 12px;
      color: var(--text-muted);
      border-bottom: 1px solid var(--card-border);
    }
    .timeline-table td {
      padding: 8px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.03);
    }
    .time-col { font-family: var(--font-mono); color: var(--text-muted); width: 140px; }
    .summary-col { font-weight: 500; }
    .file-col { font-family: var(--font-mono); color: #60a5fa; font-size: 0.78rem; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 0.72rem;
      text-transform: uppercase;
      font-weight: 700;
    }
    .badge-error { background: #7f1d1d; color: #fca5a5; }
    .badge-warn { background: #78350f; color: #fde68a; }
    .badge-info { background: #1e3a8a; color: #bfdbfe; }
    .step-item {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
      font-family: var(--font-mono);
      font-size: 0.9rem;
    }
    .step-marker { color: var(--text-muted); width: 24px; text-align: center; }
    .step-last .step-text { color: var(--accent-red); font-weight: 700; }
    .tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 8px;
    }
    .tab-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 8px 16px;
      cursor: pointer;
      border-radius: 6px;
      font-weight: 600;
    }
    .tab-btn.active {
      background: var(--card-border);
      color: white;
    }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="logo-badge">WhatItBroke</div>
      <div class="title-group">
        <h1>${escapeHtml(error.name)}: ${escapeHtml(error.message)}</h1>
        <p>Report Generated: ${new Date(report.timestamp).toLocaleString()}</p>
      </div>
    </div>
    <div class="conf-badge">
      <span class="conf-label">Confidence</span>
      <span class="conf-value">${conf}%</span>
    </div>
  </div>

  <div class="grid">
    <div>
      <div class="card">
        <div class="card-title">📍 Affected Location</div>
        <div class="loc-banner">${escapeHtml(loc.file)}:${loc.line}${loc.column ? `:${loc.column}` : ''} ${loc.functionName ? `— ${escapeHtml(loc.functionName)}` : ''}</div>
        
        <div class="card-title">🔍 Root Cause (Why)</div>
        <div class="cause-box">${escapeHtml(report.rootCause)}</div>

        ${report.trigger ? `
          <div class="card-title">⚡ Trigger</div>
          <p style="margin-bottom: 16px; color: var(--text-muted);">${escapeHtml(report.trigger)}</p>
        ` : ''}

        <div class="card-title">🛠️ Recommended Fix (How)</div>
        <div class="fix-box">
          <h3>${escapeHtml(report.suggestedFix.title)}</h3>
          <p>${escapeHtml(report.suggestedFix.explanation)}</p>
        </div>

        <div class="tabs">
          <button class="tab-btn active" onclick="switchTab('snippet')">Source Snippet</button>
          <button class="tab-btn" onclick="switchTab('diff')">Suggested Patch</button>
          <button class="tab-btn" onclick="switchTab('timeline')">Timeline (${report.timeline.length})</button>
          <button class="tab-btn" onclick="switchTab('raw')">Debug Context JSON</button>
        </div>

        <div id="tab-snippet" class="tab-content active">
          <div class="snippet-viewer">${sourceSnippetRows}</div>
        </div>

        <div id="tab-diff" class="tab-content">
          <div class="diff-viewer">${diffHtml}</div>
        </div>

        <div id="tab-timeline" class="tab-content">
          <table class="timeline-table">
            <thead>
              <tr><th>Timestamp</th><th>Type</th><th>Summary</th><th>Location</th></tr>
            </thead>
            <tbody>${timelineRows}</tbody>
          </table>
        </div>

        <div id="tab-raw" class="tab-content">
          <pre class="snippet-viewer" style="padding: 16px; max-height: 400px; overflow: auto;"><code>${escapeHtml(jsonContext)}</code></pre>
        </div>
      </div>
    </div>

    <div>
      <div class="card">
        <div class="card-title">Execution Path</div>
        <div style="margin-top: 12px;">${execPathItems}</div>
      </div>

      <div class="card">
        <div class="card-title">Evidence</div>
        <ul style="padding-left: 20px; color: var(--text-muted); font-size: 0.9rem;">
          ${report.evidence.map((ev) => `<li style="margin-bottom: 6px;">${escapeHtml(ev)}</li>`).join('\n')}
        </ul>
      </div>

      ${report.possibleSideEffects.length > 0 ? `
        <div class="card">
          <div class="card-title" style="color: var(--accent-yellow);">Side Effects / Warnings</div>
          <ul style="padding-left: 20px; color: #fde68a; font-size: 0.88rem;">
            ${report.possibleSideEffects.map((se) => `<li style="margin-bottom: 6px;">${escapeHtml(se)}</li>`).join('\n')}
          </ul>
        </div>
      ` : ''}
    </div>
  </div>

  <script>
    function switchTab(name) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      event.target.classList.add('active');
      document.getElementById('tab-' + name).classList.add('active');
    }
  </script>
</body>
</html>`;
  }
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
