/**
 * WhatItBroke - Google Gemini Provider
 */

import { DebugContext } from '@whatitbroke/shared';
import { AIAnalysisResult, AIAnalyzer, AIProviderConfig } from '../types.js';
import { PromptBuilder } from '../prompt-builder.js';

export class GeminiAnalyzer implements AIAnalyzer {
  public readonly name = 'gemini';
  private apiKey: string;
  private model: string;

  constructor(config: AIProviderConfig = {}) {
    this.apiKey = config.apiKey || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY || '' : '');
    this.model = config.model || 'gemini-1.5-flash';
  }

  public async analyze(context: DebugContext): Promise<AIAnalysisResult> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const prompt = PromptBuilder.buildPrompt(context);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}: ${await response.text()}`);
    }

    const data: any = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(content || '{}');

    return {
      provider: 'gemini',
      explanation: parsed.explanation || 'Root cause analyzed by Gemini.',
      confidenceAdjustment: parsed.confidenceAdjustment || 0,
      rootCauseRefinement: parsed.rootCauseRefinement,
      additionalFixes: parsed.additionalFixes || [],
    };
  }
}
