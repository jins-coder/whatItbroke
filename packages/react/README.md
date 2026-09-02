# @whatitbroke/react

> **React Adapter, Error Boundary, Component Render Path Tracer, and Hook Rules Analyzer**

[![npm version](https://img.shields.io/npm/v/@whatitbroke/react.svg)](https://www.npmjs.com/package/@whatitbroke/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

`@whatitbroke/react` provides seamless error capture and root-cause analysis for React 18 & 19 applications, including component render hierarchy reconstruction and conditional hook violation detection.

---

## Installation

```bash
npm install @whatitbroke/react @whatitbroke/core @whatitbroke/shared
```

---

## Features

* **`<WhatItBrokeBoundary>`**: Drop-in React Error Boundary component with customizable fallback UI and interactive developer overlay.
* **Component Render Path**: Parses React's `componentStack` into a chronological root-to-leaf path (e.g. `App ──► Dashboard ──► UserProfile`).
* **Hook Rules Detector**: Statically diagnoses conditional `useState`/`useEffect` calls, hook count mismatches, and missing dependency arrays.
* **Async Race Detection**: Detects when components attempt to render data before asynchronous `useQuery` or `fetch` calls have completed.

---

## Usage

### 1. Wrap Your Application with `<WhatItBrokeBoundary>`

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { WhatItBrokeBoundary } from '@whatitbroke/react';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WhatItBrokeBoundary
      showOverlay={process.env.NODE_ENV === 'development'}
      fallback={<div>An unexpected error occurred. Our team has been notified.</div>}
      onError={(report) => {
        console.error('WhatItBroke Report:', report);
      }}
    >
      <App />
    </WhatItBrokeBoundary>
  </React.StrictMode>
);
```

---

### 2. Hook Rules Violation Detection
When React throws `Rendered fewer hooks than expected`, WhatItBroke isolates the exact conditional branch causing the discrepancy:

```tsx
// ❌ Dangerous: Hooks inside conditions
function Profile({ user }) {
  if (!user) return <Loading />;
  
  // WhatItBroke detects this conditional hook violation and provides the fix!
  const [data, setData] = useState(null);
  ...
}
```

---

### 3. Programmatic React Adapter

```ts
import { ReactAdapter } from '@whatitbroke/react';
import { WhatItBrokeCore } from '@whatitbroke/core';

const core = new WhatItBrokeCore();
const adapter = new ReactAdapter(core);

// Analyze React error with componentStack:
const report = await adapter.handleReactError(error, {
  componentStack: errorInfo.componentStack
});

console.log(report.context.executionPath);
// ['App', 'Dashboard', 'UserProfile']
```

---

## Zero-Bloat Guarantee
`@whatitbroke/react` contains **zero Vue, Angular, or backend Node.js code**. It adds less than 8 kB to your frontend bundle and has `react` as an optional `peerDependency`.

## License

MIT © [WhatItBroke Team](https://github.com/jins-coder/whatItbroke)
