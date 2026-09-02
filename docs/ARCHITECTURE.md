# WhatItBroke Architecture & Design

## Overview

WhatItBroke is a production-quality, framework-aware debugging and root-cause analysis engine for modern JavaScript and TypeScript applications.

Its primary architectural goal is to reconstruct the **execution context** surrounding a failure and answer four questions automatically:
1. **What broke?**
2. **Where did it break?**
3. **Why did it break?**
4. **How can it be fixed?**

---

## The Layered Model

```
                    ┌────────────────────────┐
                    │      WhatItBroke       │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │   Core Debug Engine    │
                    └───────────┬────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌───────▼────────┐      ┌───────▼────────┐      ┌───────▼────────┐
│  Node Adapter  │      │ React Adapter  │      │  Vue Adapter   │
└───────┬────────┘      └───────┬────────┘      └───────┬────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                                ├── Angular Adapter
                                │
                    ┌───────────▼────────────┐
                    │   Context Collector    │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │     Error Analyzer     │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │   Root Cause Engine    │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │   Fix Recommendation   │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │   Optional AI Layer    │
                    └────────────────────────┘
```

---

## Key Modules

### 1. Universal Debug Context (`@whatitbroke/shared`)
Normalizes heterogeneous framework representations into a unified interface:

```typescript
interface DebugContext {
  id: string;
  timestamp: number;
  error: ErrorInfo;
  source: SourceLocation;
  stack: StackFrame[];
  runtime: RuntimeContext;
  executionPath: ExecutionStep[];
  timeline: TimelineEvent[];
  network?: NetworkContext;
  database?: DatabaseContext;
  framework?: FrameworkContext;
  dependency?: DependencyContext;
  environment?: EnvironmentContext;
}
```

### 2. Universal Stack Parser & Sourcemap Resolver (`@whatitbroke/core`)
- Compatible with V8 (Node.js, Chrome), Gecko (Firefox), and WebKit (Safari, iOS).
- Normalizes paths across Windows (`E:\...`) and POSIX.
- Filters framework internals (`react-dom`, `node:internal`, etc.) to locate the primary application source frame.
- Resolves inline base64 sourcemaps and disk `.map` files, extracting surrounding code snippets with line numbers.

### 3. Execution Timeline (`@whatitbroke/core`)
- Thread-safe ring buffer capturing chronologically sorted application events.
- Tracks:
  - `request_start` / `request_end`
  - `api_request` / `api_response`
  - `db_query_start` / `db_query_end`
  - `state_update`
  - `component_render`
  - `undefined_value_detected`
  - `exception`

### 4. Root Cause Heuristics Engine (`@whatitbroke/core`)
Evaluates multi-stage causal chains:
- **Null Database Pointer**: Detects that a preceding DB query returned null/empty, followed by property dereference without guard.
- **Async Render Race**: In React/Vue, detects that an outbound API request was still inflight when the component attempted to render deep properties of state.
- **Hook Order Mismatch**: Analyzes React component stack and identifies conditional hook execution.
- **Vue Reactivity Loss**: Detects prop destructuring without `toRefs()`.
- **Angular NullInjectorError**: Traverses injector hierarchy to locate missing service tokens.

### 5. Fix Recommendation & Sandbox Verification (`@whatitbroke/core`, `@whatitbroke/cli`)
- Synthesizes unified diffs (`patch`).
- Assesses confidence score (0 - 100%).
- Warns of downstream side effects.
- Runs isolated sandbox testing without modifying production source code.

### 6. Zero-Leak Redaction (`@whatitbroke/shared`)
- Strips authorization tokens, session cookies, database credentials, passwords, AWS keys, and emails before any logging or export.
