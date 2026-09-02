# @whatitbroke/core

> **Framework-Agnostic Core Debug Engine, Stack Trace Parser, Sourcemap Resolver, and Root-Cause Analyzer**

[![npm version](https://img.shields.io/npm/v/@whatitbroke/core.svg)](https://www.npmjs.com/package/@whatitbroke/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

`@whatitbroke/core` is the central engine of the WhatItBroke ecosystem. It orchestrates framework adapters, decodes minified stack traces, records chronological execution timelines, computes deterministic root causes, generates unified diff patches, and outputs interactive HTML reports.

---

## Installation

```bash
npm install @whatitbroke/core @whatitbroke/shared
```

---

## Key Modules & APIs

### 1. `WhatItBrokeCore`
The central debugger orchestrator:
```ts
import { WhatItBrokeCore } from '@whatitbroke/core';

const debuggerInstance = new WhatItBrokeCore({
  maxTimelineEvents: 100,
  redact: ['password', 'authorization', 'token']
});

// Record execution steps
debuggerInstance.recordStep('Incoming HTTP request', 'api_request', { path: '/api/users' });

// Analyze an uncaught error
try {
  riskyOperation();
} catch (error) {
  const report = await debuggerInstance.analyze(error, {
    framework: 'node',
    environment: 'production'
  });

  console.log(report.rootCause.summary);
  console.log(report.fix.patch); // Unified code diff
}
```

---

### 2. `StackParser`
Cross-platform stack trace parser supporting V8 (Node, Chrome, Edge), Gecko (Firefox), and WebKit (Safari) traces:
```ts
import { StackParser } from '@whatitbroke/core';

const frames = StackParser.parse(error.stack);
console.log(frames[0]);
// {
//   file: '/src/services/user.service.ts',
//   line: 82,
//   column: 15,
//   methodName: 'UserService.getProfile',
//   isAsync: true,
//   isInternal: false
// }

// Automatically filter out node_modules and framework internals:
const primaryFrame = StackParser.getPrimaryFrame(frames);
```

---

### 3. `SourceMapResolver`
Decodes disk sourcemaps (`.map`) and inline base64 sourcemaps to extract original code snippets with line numbers:
```ts
import { SourceMapResolver } from '@whatitbroke/core';

const snippet = SourceMapResolver.extractSnippet({
  filePath: '/src/services/user.service.ts',
  targetLine: 82,
  contextLines: 3 // Surrounding lines
});

console.log(snippet);
// [
//   { line: 80, content: '    const user = await db.query(...);', isErrorLine: false },
//   { line: 81, content: '', isErrorLine: false },
//   { line: 82, content: '    return user.profile.name;', isErrorLine: true },
//   { line: 83, content: '  }', isErrorLine: false }
// ]
```

---

### 4. `TimelineRecorder`
Memory-bounded ring buffer tracking chronological events immediately preceding a crash:
```ts
import { TimelineRecorder } from '@whatitbroke/core';

const timeline = new TimelineRecorder(100);

timeline.record('request_start', 'GET /api/users/42');
timeline.recordDbQuery('SELECT * FROM users WHERE id = 42', 12, null); // Tracks empty result
timeline.record('exception', 'TypeError: Cannot read properties of undefined');

const events = timeline.getEvents();
```

---

### 5. `RootCauseEngine` & `FixGenerator`
Multi-stage causal heuristic analyzer:
```ts
import { RootCauseEngine, FixGenerator } from '@whatitbroke/core';

// Compute 4 questions: What, Where, Why, How
const rootCause = RootCauseEngine.analyze(debugContext);
const fix = FixGenerator.generate(rootCause, debugContext);

console.log(`Confidence: ${fix.confidence}%`);
console.log(`Explanation: ${fix.explanation}`);
console.log(`Patch:\n${fix.patch}`);
```

---

### 6. `HtmlReporter`
Exports standalone, zero-dependency interactive dark-mode HTML reports with embedded tabs:
```ts
import { HtmlReporter } from '@whatitbroke/core';

const html = HtmlReporter.generate(report);
fs.writeFileSync('whatitbroke-report.html', html);
```

---

## License

MIT © [WhatItBroke Team](https://github.com/jins-coder/whatItbroke)
