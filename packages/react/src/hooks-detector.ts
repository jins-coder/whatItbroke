/**
 * WhatItBroke - React Hook Rules Detector
 * Analyzes hook order violations, conditional hooks, and lifecycle hook mismatches.
 */

export interface HookErrorInfo {
  isHookError: boolean;
  type: 'conditional_hook' | 'invalid_call' | 'missing_dependency' | 'other';
  message: string;
  expectedOrder?: number;
  actualOrder?: number;
  advice: string;
}

export class HooksDetector {
  public static analyze(error: Error | { message: string }): HookErrorInfo {
    const msg = error.message || '';

    if (
      msg.includes('Rendered fewer hooks than expected') ||
      msg.includes('Rendered more hooks than expected') ||
      msg.includes('rendered more hooks than during the previous render') ||
      msg.includes('rendered fewer hooks than during the previous render')
    ) {
      return {
        isHookError: true,
        type: 'conditional_hook',
        message: msg,
        advice:
          'React Hooks must be executed in the exact same order on every render. Ensure hooks are never called inside if statements, loops, or after conditional early returns.',
      };
    }

    if (
      msg.includes('Invalid hook call') ||
      msg.includes('Hooks can only be called inside of the body of a function component')
    ) {
      return {
        isHookError: true,
        type: 'invalid_call',
        message: msg,
        advice:
          'Hooks can only be called at the top level of a React function component or custom hook. Check for mismatched React versions or calling hooks from regular JavaScript functions.',
      };
    }

    if (msg.includes('missing dependency') || msg.includes('react-hooks/exhaustive-deps')) {
      return {
        isHookError: true,
        type: 'missing_dependency',
        message: msg,
        advice:
          'useEffect/useCallback/useMemo dependency array is missing referenced state or prop variables, which may cause stale closures.',
      };
    }

    return {
      isHookError: false,
      type: 'other',
      message: msg,
      advice: '',
    };
  }
}
