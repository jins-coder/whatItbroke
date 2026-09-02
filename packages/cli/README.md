# whatitbroke

> **Universal JavaScript & TypeScript Application Debugger and Root-Cause Analysis CLI**

[![npm version](https://img.shields.io/npm/v/whatitbroke.svg)](https://www.npmjs.com/package/whatitbroke)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

`whatitbroke` answers four questions automatically when your application crashes:
1. **What broke?** — Error classification, severity, and normalized context.
2. **Where did it break?** — Original source file via sourcemaps with line numbers and highlighted code snippets.
3. **Why did it break?** — Chronological execution timeline, pending API calls, null database queries, and causal heuristics.
4. **How can it be fixed?** — Synthesized unified diff patches, side-effect analysis, and sandbox verification.

---

## Installation

### Global Installation (Recommended)
```bash
npm install -g whatitbroke
```

### Run without installing (via `npx`)
```bash
npx whatitbroke doctor
npx whatitbroke analyze
```

---

## CLI Commands Reference

### 1. `whatitbroke doctor`
Audits your environment, Node.js runtime version, TypeScript sourcemap generation, and privacy engine status.
```bash
whatitbroke doctor
```

### 2. `whatitbroke init`
Inspects your `package.json` dependencies, detects your framework (React, Vue, Angular, or Node.js), and scaffolds a customized `whatitbroke.config.json`.
```bash
whatitbroke init
# Preview without writing to disk:
whatitbroke init --dry-run
```

### 3. `whatitbroke analyze`
Analyzes runtime errors, crash logs, or specific source files and generates an actionable root-cause report with unified code diffs.
```bash
# Analyze a specific source file:
whatitbroke analyze src/services/user.service.ts

# Analyze a raw stack trace or log file:
whatitbroke analyze --file crash.log

# Pipe errors directly via stdin:
cat error.log | whatitbroke analyze
```

### 4. `whatitbroke report`
Exports diagnostic reports to colored terminal UI, standalone dark-mode HTML dashboard, or structured JSON.
```bash
# Generate interactive dark-mode HTML report:
whatitbroke report --format html --output report.html

# Export machine-readable JSON context:
whatitbroke report --format json --output report.json
```

### 5. `whatitbroke verify`
**Isolated Sandbox Fix Verification Pipeline**: Tests the proposed fix in an isolated temporary sandbox without touching production files.
```bash
whatitbroke verify src/services/user.service.ts
```
1. Creates an ephemeral sandbox in temporary directory.
2. Copies target files and applies the proposed unified patch.
3. Runs TypeScript syntax and type-checking validation.
4. Simulates runtime execution to assert the original error is eliminated.
5. Deletes temporary sandbox leaving your repository untouched.

### 6. `whatitbroke config`
Inspects the active configuration, redaction rules, active adapters, and AI provider settings.
```bash
whatitbroke config
```

---

## Configuration (`whatitbroke.config.json`)

```json
{
  "framework": "node",
  "adapters": [
    "@whatitbroke/node"
  ],
  "redact": [
    "authorization",
    "cookie",
    "set-cookie",
    "password",
    "secret",
    "token",
    "access_token"
  ],
  "sourcemaps": true,
  "maxTimelineEvents": 100,
  "outputFormat": "cli",
  "outputDirectory": ".whatitbroke",
  "ai": {
    "enabled": false,
    "provider": "openai",
    "model": "gpt-4o-mini"
  }
}
```

---

## Privacy Guarantee

WhatItBroke runs **100% offline by default**. The built-in privacy engine automatically redacts Authorization headers, cookies, passwords, database URLs, JWTs, and AWS credentials before any output or report is generated.

## License

MIT © [WhatItBroke Team](https://github.com/jins-coder/whatItbroke)
