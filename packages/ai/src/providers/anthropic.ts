/**
 * WhatItBroke - Anthropic Provider
 */

import { DebugContext } from '@whatitbroke/shared';
import { AIAnalysisResult, AIAnalyzer, AIProviderConfig } from '../types.js';
import { PromptBuilder } from '../prompt-builder.js';

export class AnthropicAnalyzer implements AIAnalyzer {
  public readonly name = 'anthropic';
  private apiKey: string;
  private model: string;

  constructor(config: AIProviderConfig = {}) {
    this.apiKey = config.apiKey || (typeof process !== 'undefined' ? process.env.ANTHROPIC_API_KEY || '' : '');
    this.model = config.model || 'claude-3-5-sonnet-20241022';
  }

  public async analyze(context: DebugContext): Promise<AIAnalysisResult> {
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    const prompt = PromptBuilder.buildPrompt(context);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
        system: 'You are WhatItBroke AI debugger. Output valid JSON only without markdown fences.',
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API returned status ${response.status}: ${await response.text()}`);
    }

    const data: any = await response.json();
    const content = data.content?.[0]?.text;
    const cleanJson = content ? content.replace(/```json\n?|\n?```/g, '').trim() : '{}';
    const parsed = JSON.parse(cleanJson);

    return {
      provider: 'anthropic',
      explanation: parsed.explanation || 'Root cause analyzed by Anthropic.',
      confidenceAdjustment: parsed.confidenceAdjustment || 0,
      rootCauseRefinement: parsed.rootCauseRefinement,
      additionalFixes: parsed.additionalFixes || [],
    };
  }
}
