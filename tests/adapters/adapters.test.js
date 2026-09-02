import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeAdapter } from '../../packages/node/dist/index.js';
import { ReactAdapter, HooksDetector } from '../../packages/react/dist/index.js';
import { VueAdapter } from '../../packages/vue/dist/index.js';
import { AngularAdapter, DIAnalyzer } from '../../packages/angular/dist/index.js';

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

test('VueAdapter - extracts component names from Vue 3 instances', () => {
  const adapter = new VueAdapter();
  const instance = {
    $options: { name: 'ProductList' },
    $props: { items: [] },
  };

  const name = adapter.extractComponentName(instance);
  assert.equal(name, 'ProductList');

  const context = adapter.captureContext(new Error('Vue crash'), {
    instance,
    info: 'render function',
  });
  assert.equal(context.framework.name, 'vue');
  assert.equal(context.framework.component.name, 'ProductList');
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
