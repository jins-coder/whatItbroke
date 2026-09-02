# WhatItBroke — Universal Application Debugger

> **«WhatItBroke is a universal JavaScript/TypeScript debugging engine that explains what broke, why it broke, and how to fix it.»**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-26%20passing-success.svg)]()

---

## Core Purpose

Traditional error monitoring tools only log a message and a stack trace. When an application crashes, developers are left manually piecing together what state was mutated, what database queries executed, or which component rendered prematurely.

**WhatItBroke answers four questions automatically:**

1. **What broke?** — Error classification, normalized exception type, and impact severity.
2. **Where did it break?** — Original source file, function/component name, exact line and column snippet.
3. **Why did it break?** — Reconstructed execution timeline, pending network calls, null query results, and root cause heuristics.
4. **How can it be fixed?** — Actionable fix suggestions, unified code diffs (`patch`), potential side effects, and isolated sandbox verification.

```
WHAT BROKE  ──►  WHERE  ──►  WHY  ──►  WHAT CAUSED IT  ──►  HOW TO FIX  ──►  VERIFY
```

---

## Architecture

WhatItBroke employs a layered, framework-agnostic architecture:

```
                            WhatItBroke
                                 │
                          Core Debug Engine
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
   Node Adapter             React Adapter            Vue Adapter
                                                          │
                                                    Angular Adapter
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 │
                          Context Collector
                                 │
                          Error Analyzer
                                 │
                          Root Cause Engine
                                 │
                         Fix Recommendation
                                 │
                          Optional AI Layer
```

### Monorepo Packages

| Package | Version | Description |
|---|---|---|
| [`@whatitbroke/shared`](./packages/shared) | `1.0.0` | Universal context models, types, formatter, and privacy redactor |
| [`@whatitbroke/core`](./packages/core) | `1.0.0` | Core debug engine, stack parser, sourcemap resolver, timeline, and root cause analyzer |
| [`@whatitbroke/node`](./packages/node) | `1.0.0` | Node.js adapter, async hooks, HTTP tracking, and DB null detectors |
| [`@whatitbroke/react`](./packages/react) | `1.0.0` | React Error Boundary, component hierarchy inspector, and hook rules detector |
| [`@whatitbroke/vue`](./packages/vue) | `1.0.0` | Vue 3 plugin, error handler, setup/template inspector, and reactivity loss analyzer |
| [`@whatitbroke/angular`](./packages/angular) | `1.0.0` | Angular ErrorHandler, dependency injection (DI) analyzer, and RxJS tracker |
| [`@whatitbroke/ai`](./packages/ai) | `1.0.0` | Optional multi-provider AI reasoning layer (OpenAI, Gemini, Anthropic, Mock) |
| [`@whatitbroke/cli`](./packages/cli) | `1.0.0` | Developer CLI (`init`, `doctor`, `analyze`, `report`, `verify`, `config`) |

---

## Example Output

```
🔴 WHAT IT BROKE

TypeError: Cannot read properties of undefined (reading 'name')

📍 src/services/user.service.ts:82

FUNCTION
UserService.getProfile()

CAUSE
user.profile is null after the database query.

EXECUTION PATH

  GET /api/profile
  ↓
  UserController
  ↓
  UserService.getProfile()
  ↓
  Database query
  ↓
  profile = null
  ↓
  profile.name ❌

EVIDENCE
  • Database query completed with null/empty record
  • Code attempted to access property '.name' without validating result
  • Stack trace pinpointed to src/services/user.service.ts:82

RECOMMENDED FIX
Validate the database result before accessing properties on `user.profile`.

SUGGESTED DIFF
@@ -82,1 +82,4 @@
+ if (!user || !user.profile) {
+   throw new NotFoundError('user not found in database');
+ }
  return user.profile.name;

POSSIBLE SIDE EFFECTS
  ⚠ Callers of this service method will receive null or a NotFound error instead of an unhandled TypeError crash.

VERIFICATION GUIDANCE
  Simulate a query with an unknown ID (returning null/empty) and verify the service handles the null result gracefully.

CONFIDENCE
94%
```

---

## Quick Start

### 1. Installation

```bash
# Install core and CLI
npm install @whatitbroke/core @whatitbroke/cli

# Install adapter for your framework
npm install @whatitbroke/node       # Node.js / Express / Fastify / Nest
npm install @whatitbroke/react      # React 18 / 19 / Next.js
npm install @whatitbroke/vue        # Vue 3 / Nuxt
npm install @whatitbroke/angular    # Angular 15 - 19
```

### 2. Auto-Configuration CLI

```bash
npx whatitbroke init
```

This auto-detects dependencies in your `package.json` and creates `whatitbroke.config.json`:

```json
{
  "framework": "auto",
  "adapters": ["@whatitbroke/node"],
  "redact": ["authorization", "cookie", "password", "token", "apiKey"],
  "sourcemaps": true,
  "maxTimelineEvents": 100,
  "outputFormat": "cli",
  "ai": {
    "enabled": false
  }
}
```

Check your environment:
```bash
npx whatitbroke doctor
```

---

## Framework Integration Guides

### Node.js

```typescript
import { NodeAdapter, HttpTracker, DbTracker } from '@whatitbroke/node';
import { getCore } from '@whatitbroke/core';

const adapter = new NodeAdapter();
// Automatically captures process uncaughtException and unhandledRejection
adapter.installGlobalHandlers();

// Express / Connect middleware to track requests and duration
app.use(HttpTracker.middleware());

// Database wrapper to automatically detect null or empty query returns
const user = await DbTracker.trackQuery(
  'SELECT * FROM users WHERE id = ?',
  [userId],
  () => db.query('SELECT * FROM users WHERE id = ?', [userId])
);
```

### React

```tsx
import React from 'react';
import { WhatItBrokeBoundary } from '@whatitbroke/react';

export function App() {
  return (
    <WhatItBrokeBoundary>
      <Dashboard>
        <UserProfile />
      </Dashboard>
    </WhatItBrokeBoundary>
  );
}
```

When a component crashes during render (e.g. accessing `user.profile.name` before an async fetch resolves), `<WhatItBrokeBoundary>` captures the component stack, extracts the render path (`App -> Dashboard -> UserProfile`), identifies the premature render trigger, and renders an actionable root-cause overlay with diff recommendations.

### Vue 3

```typescript
import { createApp } from 'vue';
import { WhatItBrokeVue } from '@whatitbroke/vue';
import App from './App.vue';

const app = createApp(App);

// Installs global error handler and reactivity tracker
app.use(WhatItBrokeVue, {
  logToConsole: true,
});

app.mount('#app');
```

### Angular

```typescript
import { NgModule, ErrorHandler } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { WhatItBrokeErrorHandler } from '@whatitbroke/angular';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule],
  providers: [
    { provide: ErrorHandler, useClass: WhatItBrokeErrorHandler },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

---

## Debug Timeline

WhatItBroke maintains an in-memory chronological ring buffer of events preceding an error:

```
12:01:02.100 (+   0ms)  • Request started: GET /api/profile
12:01:02.130 (+  30ms)  🌐 API request: GET /api/user/me
12:01:02.240 (+ 140ms)  💾 Database query (12ms): SELECT * FROM users...
12:01:02.241 (+ 141ms)  ⚡ State updated: userProfile
12:01:02.242 (+ 142ms)  ⚡ Component rendered: <UserProfile />
12:01:02.245 (+ 145ms)  ⚠ Undefined value detected: user.profile
12:01:02.246 (+ 146ms)  ❌ Exception: TypeError - Cannot read properties of undefined
```

---

## Fix Verification Pipeline

Never automatically modify production code. WhatItBroke verifies proposed fixes in an isolated temporary sandbox before you apply them:

```bash
npx whatitbroke verify src/services/user.service.ts
```

Pipeline:
1. **Detect & Analyze** — Isolates the target file and extracts the proposed patch.
2. **Create Sandbox** — Copies files into an ephemeral workspace.
3. **Apply Patch** — Applies the proposed fix in isolation.
4. **Run TypeScript / Syntax Validation** — Checks compilation and syntax.
5. **Verify Original Error Elimination** — Re-executes the failure scenario and asserts that the exception is eliminated.

---

## Privacy & Security

WhatItBroke is built with a strict **Privacy-First Guarantee**:

- **Automatic Zero-Leak Sanitization**: Deeply redacts passwords, access tokens, cookies, authorization headers, API keys, AWS credentials, JWTs, and database URLs.
- **Circular Reference Safe**: Safely traverses cyclic objects with WeakSet memoization.
- **Configurable**: Add custom sensitive keys or regex patterns via `whatitbroke.config.json`:
  ```json
  {
    "redact": ["internalSecretField", "paymentToken"]
  }
  ```
- **Zero External Data Leak**: No runtime data or source code is ever sent over the network unless you explicitly configure an AI provider.

---

## Optional AI Layer

WhatItBroke has **zero AI dependency**; its deterministic heuristic rules engine operates completely offline.

When an AI provider is explicitly enabled, WhatItBroke augments the root-cause report with external model reasoning:

```typescript
import { getCore } from '@whatitbroke/core';
import { createAIAnalyzer } from '@whatitbroke/ai';

const core = getCore({
  ai: {
    enabled: true,
    provider: 'openai', // or 'gemini', 'anthropic', 'mock'
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
  }
});

core.setAIAnalyzer(createAIAnalyzer('openai', { apiKey: process.env.OPENAI_API_KEY }));
```

Before sending any context to an AI provider, the payload passes through the Privacy Redactor so raw secrets and credentials never leave your machine.

---

## CLI Reference

```bash
# Auto-detect project framework and generate configuration
whatitbroke init [--dry-run] [--force]

# Audit sourcemaps, Node version, and health
whatitbroke doctor

# Analyze crash logs, stack traces, or source files
whatitbroke analyze [file-or-trace] [--format=cli|json|html] [--output=report.html]

# Display or export the latest report
whatitbroke report [--format=cli|json|html] [--output=report.html]

# Test proposed fix in an isolated sandbox
whatitbroke verify <target-file>

# Display active configuration and redaction keys
whatitbroke config
```

---

## Running Tests

```bash
# Run the complete test suite across all packages
npm test

# Build all packages
npm run build
```

---

## License

MIT © WhatItBroke Team
