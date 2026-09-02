# @whatitbroke/angular

> **Angular Adapter, Global ErrorHandler, and Dependency Injection / Change Detection Analyzer**

[![npm version](https://img.shields.io/npm/v/@whatitbroke/angular.svg)](https://www.npmjs.com/package/@whatitbroke/angular)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

`@whatitbroke/angular` provides deep root-cause analysis for Angular 15–19 applications, specializing in Dependency Injection failures, RxJS unhandled errors, and Change Detection bugs.

---

## Installation

```bash
npm install @whatitbroke/angular @whatitbroke/core @whatitbroke/shared
```

---

## Quickstart

### 1. Register `WhatItBrokeErrorHandler` in `AppModule` or `app.config.ts`

#### Standalone Application (`app.config.ts`):
```ts
import { ApplicationConfig, ErrorHandler } from '@angular/core';
import { WhatItBrokeErrorHandler } from '@whatitbroke/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: WhatItBrokeErrorHandler }
  ]
};
```

#### NgModule (`app.module.ts`):
```ts
import { NgModule, ErrorHandler } from '@angular/core';
import { WhatItBrokeErrorHandler } from '@whatitbroke/angular';

@NgModule({
  providers: [
    { provide: ErrorHandler, useClass: WhatItBrokeErrorHandler }
  ]
})
export class AppModule {}
```

---

## Key Capabilities

### 1. Dependency Injection Analyzer (`DIAnalyzer`)
Diagnoses common, frustrating Angular DI exceptions:
* **`NullInjectorError: No provider for X!`**: Parses the injector path hierarchy, identifies the missing service token, and generates the fix:
  ```diff
  - @Injectable()
  + @Injectable({ providedIn: 'root' })
  ```
* **`NG0200: Circular dependency detected`**: Isolates the exact cyclic loop between services.
* **`NG0100: ExpressionChangedAfterItHasBeenCheckedError`**: Identifies synchronous state mutations inside lifecycle hooks (`ngAfterViewInit`) that violate change detection.

---

### 2. Programmatic Angular Adapter

```ts
import { AngularAdapter } from '@whatitbroke/angular';
import { WhatItBrokeCore } from '@whatitbroke/core';

const core = new WhatItBrokeCore();
const adapter = new AngularAdapter(core);

// Analyze Angular exception:
const report = await adapter.handleAngularError(error);
console.log(report.rootCause.recommendation);
```

---

## Zero-Bloat Guarantee
`@whatitbroke/angular` is lightweight (~5.7 kB) and contains **zero React, Vue, or backend Node.js code**. `@angular/core` is an optional `peerDependency`.

## License

MIT © [WhatItBroke Team](https://github.com/jins-coder/whatItbroke)
