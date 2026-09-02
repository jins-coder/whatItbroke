/**
 * WhatItBroke - Vue 3 Error Boundary Component
 * Traps runtime template errors via onErrorCaptured to prevent blank screens,
 * analyzes the root cause, triggers the diagnostics overlay, and renders a fallback UI.
 */

import { defineComponent, ref, onErrorCaptured, h } from 'vue';
import type { PropType, VNode } from 'vue';
import { VueAdapter } from './adapter.js';
import { VueErrorOverlay } from './overlay.js';

export const WhatItBrokeErrorBoundary = defineComponent({
  name: 'WhatItBrokeErrorBoundary',
  props: {
    fallback: {
      type: Function as PropType<(err: Error, reset: () => void) => VNode | VNode[]>,
      default: null,
    },
    showOverlay: {
      type: Boolean,
      default: true,
    },
    inlineFallback: {
      type: Boolean,
      default: true,
    },
  },
  setup(props, { slots }) {
    const adapter = new VueAdapter();
    const error = ref<Error | null>(null);

    const reset = () => {
      error.value = null;
    };

    onErrorCaptured((err, instance, info) => {
      const errObj = err instanceof Error ? err : new Error(String(err));
      error.value = errObj;

      adapter
        .analyzeVueError(errObj, { instance, info })
        .then((report) => {
          if (props.showOverlay !== false) {
            VueErrorOverlay.addReport(report, errObj);
          }
        })
        .catch((analysisErr) => {
          console.error('WhatItBroke Error Boundary failed during analysis:', analysisErr);
        });

      // Returning false prevents Vue from tearing down the entire app / unmounting the root
      return false;
    });

    return () => {
      if (error.value) {
        if (slots.fallback) {
          return slots.fallback({ error: error.value, reset });
        }
        if (props.fallback) {
          return props.fallback(error.value, reset);
        }

        if (props.inlineFallback === false) {
          return null;
        }

        // Subtle, high-contrast inline fallback banner
        return h(
          'div',
          {
            style: {
              padding: '14px 18px',
              margin: '12px 0',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '8px',
              color: '#f8fafc',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            },
          },
          [
            h('div', [
              h(
                'div',
                { style: { fontWeight: '700', fontSize: '13px', color: '#f87171' } },
                `🔴 Component Crashed: ${error.value.message}`
              ),
              h(
                'div',
                { style: { fontSize: '11px', color: '#94a3b8', marginTop: '2px' } },
                'WhatItBroke trapped this error to prevent a blank screen. Check the diagnostics overlay for the fix.'
              ),
            ]),
            h(
              'button',
              {
                onClick: reset,
                style: {
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                },
              },
              '↻ Retry'
            ),
          ]
        );
      }

      return slots.default ? slots.default() : null;
    };
  },
});
