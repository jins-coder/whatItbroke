# Framework Adapters Guide

WhatItBroke's core is strictly framework-agnostic. Adapters interface with framework-specific runtimes and lifecycle hooks to capture rich context.

---

## The DebugAdapter Interface

Custom adapters implement the `DebugAdapter` interface:

```typescript
import { DebugContext, ComponentContext, RuntimeContext } from '@whatitbroke/shared';

export interface DebugAdapter {
  name: string;
  framework: 'node' | 'react' | 'vue' | 'angular' | 'vanilla';
  detect(): boolean;
  captureContext(error: unknown, extras?: Record<string, unknown>): Promise<DebugContext> | DebugContext;
  getComponentContext?(): ComponentContext | undefined;
  getRuntimeContext?(): RuntimeContext;
  dispose?(): void;
}
```

---

## Supported Adapters

### `@whatitbroke/node`

- **Detection**: Checks `process.versions.node` and absence of browser DOM.
- **Process Hooks**: Installs `process.on('uncaughtException')` and `process.on('unhandledRejection')`.
- **HTTP Tracker**: Connect / Express middleware tracking routes, HTTP methods, headers, and duration.
- **Database Tracker**: Instruments SQL queries, records execution timing, and flags null or empty record returns.

### `@whatitbroke/react`

- **Detection**: Inspects `globalThis.React`, React DevTools hooks, or DOM root.
- **Error Boundary**: `<WhatItBrokeBoundary>` captures component crashes and renders an actionable root-cause overlay.
- **Component Stack**: Parses React component hierarchy and reconstructs root-to-leaf render path.
- **Hook Rules Detector**: Detects conditional hook calls, mismatched counts, and missing dependency array elements.

### `@whatitbroke/vue`

- **Detection**: Inspects `globalThis.__VUE__` or Vue DevTools hook.
- **Vue 3 Plugin**: `app.use(WhatItBrokeVue)` sets `app.config.errorHandler`.
- **Reactivity Tracker**: Identifies reactivity loss caused by direct prop destructuring or missing `.value` unwrapping.

### `@whatitbroke/angular`

- **Detection**: Inspects `globalThis.ng` or `globalThis.Zone`.
- **ErrorHandler**: `WhatItBrokeErrorHandler` implements Angular's `ErrorHandler` interface.
- **DI Analyzer**: Inspects `NullInjectorError` and circular injection dependencies (`NG0200`).
