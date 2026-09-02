/**
 * WhatItBroke - React Error Boundary Component
 * Wraps React components, captures crashes, and renders an actionable root-cause overlay.
 */

import React, { Component, ErrorInfo as ReactErrorInfo, ReactNode } from 'react';
import { RootCauseReport } from '@whatitbroke/shared';
import { ReactAdapter } from './adapter.js';

export interface WhatItBrokeBoundaryProps {
  children: ReactNode;
  fallback?: (report: RootCauseReport | null, error: Error) => ReactNode;
  onError?: (report: RootCauseReport, error: Error) => void;
  showOverlay?: boolean;
}

interface WhatItBrokeBoundaryState {
  hasError: boolean;
  error: Error | null;
  report: RootCauseReport | null;
}

export class WhatItBrokeBoundary extends Component<WhatItBrokeBoundaryProps, WhatItBrokeBoundaryState> {
  private adapter: ReactAdapter;

  constructor(props: WhatItBrokeBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      report: null,
    };
    this.adapter = new ReactAdapter();
  }

  static getDerivedStateFromError(error: Error): Partial<WhatItBrokeBoundaryState> {
    return { hasError: true, error };
  }

  override async componentDidCatch(error: Error, errorInfo: ReactErrorInfo): Promise<void> {
    const report = await this.adapter.analyzeReactError(error, {
      componentStack: errorInfo.componentStack || undefined,
    });

    this.setState({ report });

    if (this.props.onError) {
      this.props.onError(report, error);
    }
  }

  override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback && this.state.error) {
      return this.props.fallback(this.state.report, this.state.error);
    }

    // Default actionable overlay
    const report = this.state.report;
    const err = this.state.error;

    return (
      <div
        style={{
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
          background: '#0f172a',
          color: '#f8fafc',
          padding: '24px',
          borderRadius: '12px',
          border: '1px solid #ef4444',
          margin: '20px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span
            style={{
              background: '#ef4444',
              color: 'white',
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              letterSpacing: '1px',
            }}
          >
            WHAT IT BROKE
          </span>
          <h2 style={{ fontSize: '18px', margin: 0, color: '#f87171' }}>
            {err?.name}: {err?.message}
          </h2>
        </div>

        {report ? (
          <div>
            <div style={{ marginBottom: '12px', color: '#94a3b8', fontSize: '13px' }}>
              📍 <strong>{report.affectedLocation.file}:{report.affectedLocation.line}</strong>
            </div>

            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '12px', color: '#fca5a5', textTransform: 'uppercase' }}>
                Cause (Why)
              </div>
              <div style={{ marginTop: '4px', fontSize: '14px', color: '#fef2f2' }}>
                {report.rootCause}
              </div>
            </div>

            <div
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '12px', color: '#6ee7b7', textTransform: 'uppercase' }}>
                Recommended Fix (How)
              </div>
              <div style={{ marginTop: '4px', fontSize: '14px', color: '#ecfdf5' }}>
                {report.suggestedFix.explanation}
              </div>
            </div>

            {report.suggestedFix.suggestedPatch && (
              <pre
                style={{
                  background: '#090d16',
                  padding: '12px',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  overflowX: 'auto',
                  border: '1px solid #1e293b',
                  color: '#a7f3d0',
                }}
              >
                {report.suggestedFix.suggestedPatch}
              </pre>
            )}
          </div>
        ) : (
          <div style={{ color: '#94a3b8', fontSize: '14px' }}>
            Analyzing component crash and reconstructing execution path...
          </div>
        )}
      </div>
    );
  }
}
