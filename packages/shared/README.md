# @whatitbroke/shared

> **Shared Types, Zero-Leak Privacy Redactor, and Terminal Formatters for WhatItBroke**

[![npm version](https://img.shields.io/npm/v/@whatitbroke/shared.svg)](https://www.npmjs.com/package/@whatitbroke/shared)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

`@whatitbroke/shared` provides the universal data models, the privacy engine, and the ANSI terminal visualizers used across the entire WhatItBroke ecosystem.

---

## Installation

```bash
npm install @whatitbroke/shared
```

---

## Key Modules & APIs

### 1. `Redactor` (Zero-Leak Privacy Engine)
Protects sensitive production data by recursively redacting secrets, authorization tokens, cookies, passwords, and PII from error contexts before serialization:

```ts
import { Redactor } from '@whatitbroke/shared';

const redactor = new Redactor({
  additionalKeys: ['custom_secret', 'internal_key'],
  maskValue: '[REDACTED]'
});

// Redacts plain objects, headers, circular structures, and strings
const payload = {
  user: 'admin',
  password: 'supersecretpassword',
  headers: {
    authorization: 'Bearer eyJhbGciOiJIUzI1Ni...',
    cookie: 'session_id=abc123xyz'
  },
  dbUrl: 'postgres://admin:topsecret@localhost:5432/mydb'
};

const safe = redactor.redact(payload);
console.log(safe.password); // '[REDACTED]'
console.log(safe.headers.authorization); // '[REDACTED]'
console.log(safe.dbUrl); // 'postgres://admin:[REDACTED]@localhost:5432/mydb'
```

#### Protected Patterns:
* **Circular Reference Protection**: Uses `WeakSet` tracking to prevent infinite recursion on self-referential objects.
* **Sensitive Keys**: `authorization`, `cookie`, `set-cookie`, `password`, `passwd`, `pwd`, `secret`, `token`, `access_token`, `refresh_token`, `apikey`, `private_key`, `ssn`.
* **String Patterns**: Bearer tokens, JSON Web Tokens (JWT), AWS Access Key IDs, credit cards, emails, and database/HTTP connection string passwords (`user:pass@host`).

---

### 2. Normalized Type System
Exports the standardized TypeScript definitions for the WhatItBroke debugger:

```ts
import type {
  DebugContext,
  ErrorInfo,
  SourceLocation,
  StackFrame,
  TimelineEvent,
  RootCauseReport,
  FixRecommendation,
  DebugAdapter,
  WhatItBrokeConfig
} from '@whatitbroke/shared';
```

---

### 3. CLI Terminal Formatters
Formats rich, ANSI-colored diagnostic cards and unified code diffs in the terminal:

```ts
import { formatReportCLI, formatTimelineCLI } from '@whatitbroke/shared';

// Render full diagnostic report with confidence badge and code diff
console.log(formatReportCLI(report));

// Render chronological execution timeline
console.log(formatTimelineCLI(timelineEvents));
```

---

## License

MIT © [WhatItBroke Team](https://github.com/jins-coder/whatItbroke)
