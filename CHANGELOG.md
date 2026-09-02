# Changelog

All notable changes to the WhatItBroke ecosystem will be documented in this file.

## [1.0.2] - 2026-09-02

### Summary
Major stability and developer experience release delivering browser-native ESM execution, zero-configuration Vite/Webpack compatibility, universal Shadow DOM in-page error diagnostics, and full Vue 3 lifecycle & hierarchy introspection.

---

### Fixed
- **`@whatitbroke/shared`**:
  - Fixed `ReferenceError: process is not defined` during top-level module evaluation in browser environments by guarding `process.env.NO_COLOR` and `process.stdout?.isTTY` behind `typeof process !== 'undefined' && Boolean(process?.env)`.
- **`@whatitbroke/core`**:
  - Removed static top-level `node:fs` and `node:path` imports from `engine.ts` and `sourcemap/resolver.ts` that triggered Vite pre-bundling warnings and Webpack client resolution errors.
  - Made `saveReportToFile` asynchronous with dynamic `await import('node:fs')` guarded by runtime environment checks (`process.versions?.node`).
  - Added browser guards in `SourceMapResolver.getFileContent` to cleanly skip filesystem lookups in browser runtimes.
- **`@whatitbroke/vue`**:
  - Added missing `handleVueError` alias method on `VueAdapter` matching documentation.
  - Replaced hardcoded `['App', compName]` component stack with dynamic `extractComponentStack` traversing `instance.parent` / `instance.$parent`.
  - Added support for `setupState` in component state inspection for Vue 3 `<script setup>`.

---

### Added
- **Universal In-Page Diagnostics HUD (`ErrorOverlay`)**:
  - Available across all frameworks: `@whatitbroke/vue`, `@whatitbroke/react`, `@whatitbroke/angular`, and `@whatitbroke/core`.
  - Floating badge indicator (`🔴 WhatItBroke`) with error counter and pulse indicator.
  - Interactive diagnostic popup displaying:
    - Normalized error name, message, and file/line/column location
    - Root cause diagnosis ("Why it broke")
    - Recommended fix with unified code diff / patch
    - Component hierarchy breadcrumbs (`App ❯ Parent ❯ Child`)
    - Interactive props and state inspector
    - Original source code snippet with highlighted exception line
    - Intercepted warnings (Vue reactivity loss, Angular DI issues)
    - One-click "Copy Report" button
  - **Shadow DOM Isolation**: Attached to `#whatitbroke-overlay-root` with an open Shadow DOM and `:host { all: initial }`. 100% immune to application CSS (Tailwind, Bootstrap, resets) with zero style leakage out into the host page.
- **Vue Plugin Options**:
  - `overlay?: boolean` (default: `true` in browser)
  - `overlayPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'`
  - `autoOpenOnCrash?: boolean` (default: `true`)
  - `captureReactivityLoss?: boolean` (default: `true`)
  - `captureComponentStack?: boolean` (default: `true`)
  - `customErrorHandler?: (err, instance, info) => void`
- **Zero-Configuration Guarantee**:
  - No `optimizeDeps.include` or `force: true` required in `vite.config.js`.
  - No `window.process` polyfills required in `index.html`.
  - Pure ESM with `"sideEffects": false` across all packages.
