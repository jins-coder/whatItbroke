import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeAdapter } from '../../packages/node/dist/index.js';
import { ReactAdapter, HooksDetector, WhatItBrokeBoundary, ReactErrorOverlay } from '../../packages/react/dist/index.js';
import { VueAdapter, WhatItBrokeVue, VueErrorOverlay } from '../../packages/vue/dist/index.js';
import { AngularAdapter, DIAnalyzer, AngularErrorOverlay } from '../../packages/angular/dist/index.js';

test('NodeAdapter - captures process runtime and environment context', () => {
  const adapter = new NodeAdapter();
  assert.equal(adapter.framework, 'node');
  assert.equal(adapter.detect(), true);

  const runtime = adapter.getRuntimeContext();
  assert.equal(runtime.environment, 'node');
  assert.ok(runtime.nodeVersion);
  assert.ok(runtime.memoryUsage.heapUsed >= 0);

  const context = adapter.captureContext(new Error('Node crash'));
  assert.equal(context.framework.name, 'node');
  assert.equal(context.runtime.environment, 'node');
});

test('ReactAdapter - parses componentStack into root-to-leaf renderPath', () => {
  const adapter = new ReactAdapter();
  const componentStack = `
    in UserProfile (created by Dashboard)
    in Dashboard (created by App)
    in App`;

  const parsed = adapter.parseComponentStack(componentStack);
  assert.deepEqual(parsed.renderPath, ['App', 'Dashboard', 'UserProfile']);
  assert.equal(parsed.primaryComponent, 'UserProfile');
});

test('HooksDetector - accurately detects conditional hook violations', () => {
  const hookErr = new Error('Rendered fewer hooks than expected. This may be caused by an accidental early return.');
  const analysis = HooksDetector.analyze(hookErr);

  assert.equal(analysis.isHookError, true);
  assert.equal(analysis.type, 'conditional_hook');
  assert.ok(analysis.advice.includes('Hooks must be executed in the exact same order'));
});

test('VueAdapter - extracts component names and hierarchical component stack from Vue 3 instances', () => {
  const adapter = new VueAdapter();
  const rootInstance = {
    $options: { name: 'App' },
  };
  const parentInstance = {
    type: { __name: 'Dashboard' },
    parent: rootInstance,
  };
  const childInstance = {
    $options: { name: 'ProductList' },
    $props: { items: [] },
    setupState: { count: 1 },
    parent: parentInstance,
  };

  const name = adapter.extractComponentName(childInstance);
  assert.equal(name, 'ProductList');

  const stack = adapter.extractComponentStack(childInstance);
  assert.deepEqual(stack, ['App', 'Dashboard', 'ProductList']);

  const context = adapter.captureContext(new Error('Vue crash'), {
    instance: childInstance,
    info: 'render function',
  });
  assert.equal(context.framework.name, 'vue');
  assert.equal(context.framework.component.name, 'ProductList');
  assert.deepEqual(context.framework.component.renderPath, ['App', 'Dashboard', 'ProductList']);
  assert.deepEqual(context.framework.component.state, { count: 1 });
});

test('VueAdapter - handleVueError alias method produces analysis report', async () => {
  const adapter = new VueAdapter();
  const instance = {
    $options: { name: 'UserProfile' },
  };
  const report = await adapter.handleVueError(new Error('Cannot read properties of undefined'), instance, 'setup function');
  assert.ok(report);
  assert.equal(report.context.framework.name, 'vue');
  assert.equal(report.context.framework.component.name, 'UserProfile');
});

test('WhatItBrokeVue plugin - registers errorHandler and warnHandler with reactivity filtering and chaining', async () => {
  let customHandlerCalled = false;
  let prevHandlerCalled = false;
  let warnOutput = '';

  const origWarn = console.warn;
  console.warn = (msg) => {
    warnOutput += String(msg);
  };

  try {
    const fakeApp = {
      config: {
        errorHandler: (err, instance, info) => {
          prevHandlerCalled = true;
        },
        warnHandler: null,
      },
    };

    WhatItBrokeVue.install(fakeApp, {
      logToConsole: false,
      captureReactivityLoss: true,
      captureComponentStack: true,
      customErrorHandler: (err, instance, info) => {
        customHandlerCalled = true;
      },
    });

    assert.equal(typeof fakeApp.config.errorHandler, 'function');
    assert.equal(typeof fakeApp.config.warnHandler, 'function');

    // Test error handler execution and chaining
    await fakeApp.config.errorHandler(new Error('Plugin error test'), null, 'render function');
    assert.equal(customHandlerCalled, true);
    assert.equal(prevHandlerCalled, true);

    // Test reactivity warn handler
    fakeApp.config.warnHandler('Set operation on key "items" failed: target is readonly.', null, 'component trace');
    assert.ok(warnOutput.includes('WHAT IT BROKE (Reactivity Warning)'));
  } finally {
    console.warn = origWarn;
  }
});

test('DIAnalyzer - detects Angular missing provider and parses token hierarchy', () => {
  const diErr = new Error(
    'NullInjectorError: R3InjectorError(AppModule)[DashboardComponent -> UserService]: NullInjectorError: No provider for UserService!'
  );
  const analysis = DIAnalyzer.analyze(diErr);

  assert.equal(analysis.isDIError, true);
  assert.equal(analysis.type, 'missing_provider');
  assert.equal(analysis.token, 'UserService');
  assert.deepEqual(analysis.injectorPath, ['DashboardComponent', 'UserService']);
  assert.ok(analysis.advice.includes("@Injectable({ providedIn: 'root' })"));
});

test('VueErrorOverlay - initializes singleton and captures reports and warnings', () => {
  const overlay = VueErrorOverlay.init({ position: 'bottom-right', autoOpenOnCrash: true });
  assert.ok(overlay);
  assert.equal(VueErrorOverlay.getInstance(), overlay);

  const mockReport = {
    headline: 'Overlay test headline',
    affectedLocation: { file: 'src/App.vue', line: 12 },
    rootCause: 'Mock cause',
    suggestedFix: { explanation: 'Mock fix' },
    context: {
      error: { name: 'TypeError', message: 'test' },
      runtime: { environment: 'browser' },
    },
  };

  VueErrorOverlay.addReport(mockReport);
  VueErrorOverlay.addWarning('Avoid mutating a prop directly');

  // Verify methods work without error
  overlay.open();
  overlay.close();
  overlay.clear();
});

test('ReactErrorOverlay and AngularErrorOverlay - re-exported cleanly across framework packages', () => {
  assert.ok(ReactErrorOverlay);
  assert.ok(AngularErrorOverlay);
  assert.equal(typeof ReactErrorOverlay.init, 'function');
  assert.equal(typeof AngularErrorOverlay.init, 'function');
});

test('WhatItBrokeBoundary - implements reset recovery callback', () => {
  const boundary = new WhatItBrokeBoundary({ children: null });
  boundary.state = {
    hasError: true,
    error: new Error('Simulated crash'),
    report: { rootCause: 'test' },
  };

  assert.equal(boundary.state.hasError, true);
  boundary.reset();
  assert.equal(boundary.state.hasError, false);
  assert.equal(boundary.state.error, null);
  assert.equal(boundary.state.report, null);
});

test('VueAdapter - infers component name from type.__file in <script setup>', () => {
  const adapter = new VueAdapter();
  const setupInstance = {
    type: { __file: 'src/components/UserProfileCard.vue' },
  };
  const name = adapter.extractComponentName(setupInstance);
  assert.equal(name, 'UserProfileCard');
});


