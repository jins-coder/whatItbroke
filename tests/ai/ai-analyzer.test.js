import test from 'node:test';
import assert from 'node:assert/strict';
import { createAIAnalyzer, PromptBuilder } from '../../packages/ai/dist/index.js';

test('AI Layer - creates MockAIAnalyzer and returns structured result', async () => {
  const analyzer = createAIAnalyzer('mock');
  assert.equal(analyzer.name, 'mock');

  const context = {
    id: 'ctx_test',
    timestamp: Date.now(),
    error: { name: 'TypeError', message: 'test error', timestamp: Date.now() },
    source: { file: 'test.ts', line: 10, column: 5 },
    stack: [],
    runtime: { environment: 'node' },
    executionPath: [],
    timeline: [],
    framework: { name: 'node' },
  };

  const result = await analyzer.analyze(context);

  assert.equal(result.provider, 'mock');
  assert.ok(result.explanation.includes('TypeError'));
  assert.ok(result.confidenceAdjustment);
  assert.ok(Array.isArray(result.additionalFixes));
});

test('PromptBuilder - ensures secrets and credentials are sanitized before prompt formatting', () => {
  const context = {
    id: 'ctx_secrets',
    timestamp: Date.now(),
    error: {
      name: 'AuthError',
      message: 'Failed with Bearer secret_live_token_12345',
      timestamp: Date.now(),
    },
    source: { file: 'auth.ts', line: 20, column: 1 },
    stack: [],
    runtime: { environment: 'node' },
    executionPath: [],
    timeline: [
      {
        id: '1',
        timestamp: 100,
        type: 'api_request',
        summary: 'Call with token Bearer abc123def456',
      },
    ],
    framework: { name: 'node' },
  };

  const prompt = PromptBuilder.buildPrompt(context);

  assert.ok(!prompt.includes('secret_live_token_12345'));
  assert.ok(!prompt.includes('abc123def456'));
  assert.ok(prompt.includes('[REDACTED]'));
});
