/**
 * WhatItBroke - OpenAI Provider
 */

import { DebugContext } from '@whatitbroke/shared';
import { AIAnalysisResult, AIAnalyzer, AIProviderConfig } from '../types.js';
import { PromptBuilder } from '../prompt-builder.js';

export class OpenAIAnalyzer implements AIAnalyzer {
  public readonly name = 'openai';
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: AIProviderConfig = {}) {
    this.apiKey = config.apiKey || (typeof process !== 'undefined' ? process.env.OPENAI_API_KEY || '' : '');
    this.model = config.model || 'gpt-4o-mini';
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  public async analyze(context: DebugContext): Promise<AIAnalysisResult> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const prompt = PromptBuilder.buildPrompt(context);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are WhatItBroke AI debugger. Output valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API returned status ${response.status}: ${await response.text()}`);
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content || '{}');

    return {
      provider: 'openai',
      explanation: parsed.explanation || 'Root cause analyzed by OpenAI.',
      confidenceAdjustment: parsed.confidenceAdjustment || 0,
      rootCauseRefinement: parsed.rootCauseRefinement,
      additionalFixes: parsed.additionalFixes || [],
    };
  }
}
