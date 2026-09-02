/**
 * WhatItBroke - AI Analyzer Factory
 */

import { AIAnalyzer, AIProviderConfig } from './types.js';
import { OpenAIAnalyzer } from './providers/openai.js';
import { GeminiAnalyzer } from './providers/gemini.js';
import { AnthropicAnalyzer } from './providers/anthropic.js';
import { MockAIAnalyzer } from './providers/mock.js';

export function createAIAnalyzer(
  provider: 'openai' | 'gemini' | 'anthropic' | 'mock' | string,
  config?: AIProviderConfig
): AIAnalyzer {
  switch (provider.toLowerCase()) {
    case 'openai':
      return new OpenAIAnalyzer(config);
    case 'gemini':
      return new GeminiAnalyzer(config);
    case 'anthropic':
      return new AnthropicAnalyzer(config);
    case 'mock':
      return new MockAIAnalyzer();
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}
