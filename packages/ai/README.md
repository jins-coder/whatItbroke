# @whatitbroke/ai

> **Optional AI Augmented Reasoning Layer with Multi-Provider Connectors and Zero-Leak Redaction Gate**

[![npm version](https://img.shields.io/npm/v/@whatitbroke/ai.svg)](https://www.npmjs.com/package/@whatitbroke/ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

`@whatitbroke/ai` is an **opt-in augmented reasoning package** for WhatItBroke. It connects your debug context to LLM providers (Google Gemini, OpenAI, Anthropic Claude) to provide human-like explanations and alternative patch recommendations for obscure or complex crashes.

---

## 🔒 Privacy & Zero-Leak Redaction Gate

> **CRITICAL GUARANTEE**: WhatItBroke **never sends raw code or runtime data externally** by default.
> Even when `@whatitbroke/ai` is active, every single prompt passes through the strict [`Redactor`](https://github.com/jins-coder/whatItbroke/blob/main/packages/shared/src/redactor.ts) first:
> * All passwords, API tokens, Authorization headers, and cookies are stripped.
> * Database connection string credentials and JWTs are sanitized.
> * Only normalized execution paths and anonymized code snippets reach the LLM.

---

## Installation

```bash
npm install @whatitbroke/ai @whatitbroke/shared
```

---

## Supported Providers

* **Google Gemini**: `gemini-1.5-flash`, `gemini-1.5-pro`
* **OpenAI**: `gpt-4o-mini`, `gpt-4o`
* **Anthropic Claude**: `claude-3-5-sonnet`
* **Mock Provider**: Zero network calls, perfect for offline development and CI/CD pipelines.

---

## Usage

### 1. Using the Factory (`createAIAnalyzer`)

```ts
import { createAIAnalyzer } from '@whatitbroke/ai';

// Example: Google Gemini
const analyzer = createAIAnalyzer({
  provider: 'gemini',
  apiKey: process.env.GEMINI_API_KEY,
  model: 'gemini-1.5-flash'
});

// Example: OpenAI
const openaiAnalyzer = createAIAnalyzer({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini'
});

// Analyze sanitized debug context:
const result = await analyzer.analyze(debugContext);

console.log(result.explanation);
console.log(result.patch); // Unified code diff
console.log(`AI Confidence: ${result.confidence}%`);
```

---

### 2. Custom Prompt Formatting (`PromptBuilder`)
If you want to inspect or customize the sanitized prompt sent to the LLM:

```ts
import { PromptBuilder } from '@whatitbroke/ai';

const prompt = PromptBuilder.buildDebuggingPrompt(debugContext);
console.log(prompt);
```

---

## Configuration (`whatitbroke.config.json`)
You can enable this layer directly in your CLI configuration file:

```json
{
  "framework": "node",
  "ai": {
    "enabled": true,
    "provider": "gemini",
    "model": "gemini-1.5-flash",
    "apiKey": "process.env.GEMINI_API_KEY"
  }
}
```

---

## License

MIT © [WhatItBroke Team](https://github.com/jins-coder/whatItbroke)
