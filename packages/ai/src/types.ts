/**
 * WhatItBroke - AI Layer Types & Abstractions
 */

import { DebugContext } from '@whatitbroke/shared';

export interface AIAnalysisResult {
  explanation: string;
  confidenceAdjustment?: number;
  additionalFixes?: string[];
  rootCauseRefinement?: string;
  provider: string;
}

export interface AIAnalyzer {
  name: string;
  analyze(context: DebugContext): Promise<AIAnalysisResult>;
}

export interface AIProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  temperature?: number;
}
