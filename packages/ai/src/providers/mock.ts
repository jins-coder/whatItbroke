/**
 * WhatItBroke - Mock AI Provider
 * Deterministic analyzer for testing and CI without external network calls.
 */

import { DebugContext } from '@whatitbroke/shared';
import { AIAnalysisResult, AIAnalyzer } from '../types.js';

export class MockAIAnalyzer implements AIAnalyzer {
  public readonly name = 'mock';

  public async analyze(context: DebugContext): Promise<AIAnalysisResult> {
    const err = context.error;
    const framework = context.framework?.name || 'vanilla';

    return {
      provider: 'mock',
      explanation: `AI verified the ${err.name} within ${framework} execution flow. Property access occurred prior to data resolution or validation.`,
      confidenceAdjustment: 4,
      rootCauseRefinement: `Execution sequence confirmed unhandled ${err.name} at line ${context.source.line}.`,
      additionalFixes: [
        `Consider adding TypeScript strictNullChecks or zod runtime schema validation at the input boundary.`,
      ],
    };
  }
}
