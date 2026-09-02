# @whatitbroke/node

> **Node.js Debug Adapter, Process Context Collector, and HTTP/Database Event Trackers**

[![npm version](https://img.shields.io/npm/v/@whatitbroke/node.svg)](https://www.npmjs.com/package/@whatitbroke/node)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

`@whatitbroke/node` captures uncaught exceptions, unhandled Promise rejections, HTTP request lifecycles, and database query executions in Node.js server environments.

---

## Installation

```bash
npm install @whatitbroke/node @whatitbroke/core @whatitbroke/shared
```

---

## Quickstart

### 1. Initialize the Node Adapter
Hooks `process.on('uncaughtException')` and `process.on('unhandledRejection')` and captures process runtime metrics (memory, uptime, Node version):

```ts
import { NodeAdapter } from '@whatitbroke/node';
import { WhatItBrokeCore } from '@whatitbroke/core';

const core = new WhatItBrokeCore();
const adapter = new NodeAdapter(core);

// Start listening for crashes
adapter.install();
```

---

### 2. Express / Connect HTTP Request Tracker
Tracks incoming HTTP route paths, request methods, and request bodies (redacted) leading up to an error:

```ts
import express from 'express';
import { HttpTracker } from '@whatitbroke/node';

const app = express();

// Add HTTP tracker middleware
app.use(HttpTracker.middleware());

app.get('/api/users/:id', async (req, res) => {
  // If an error happens here, the request URL, parameters, and duration
  // will appear in the chronological timeline of the crash report!
  const user = await getUser(req.params.id);
  res.json(user);
});
```

---

### 3. Database Query Tracker
Monitors SQL/ORM queries and flags **null or empty result sets** which are the #1 cause of `TypeError: Cannot read properties of undefined`:

```ts
import { DbTracker } from '@whatitbroke/node';

async function queryUser(userId: string) {
  const tracker = DbTracker.startQuery('SELECT * FROM users WHERE id = ?', [userId]);

  const rows = await db.rawQuery('SELECT * FROM users WHERE id = ?', [userId]);

  // Ends tracking and automatically registers null/empty result alerts:
  tracker.end(rows);
  return rows[0];
}
```

---

## What It Collects
* **Runtime**: Node.js version, platform, architecture, PID, process uptime, heap memory usage.
* **Execution Path**: Async stack frames, incoming HTTP requests, and preceding database queries.
* **Redaction**: All passwords, auth tokens, cookies, and database connection secrets are redacted prior to reporting.

---

## License

MIT © [WhatItBroke Team](https://github.com/jins-coder/whatItbroke)
