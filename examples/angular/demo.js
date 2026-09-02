/**
 * WhatItBroke - Angular Example Runner
 */

import { AngularAdapter, WhatItBrokeErrorHandler } from '@whatitbroke/angular';
import { getCore } from '@whatitbroke/core';

async function main() {
  const core = getCore();
  const adapter = new AngularAdapter(core);
  core.registerAdapter(adapter);

  console.log('Starting Angular Application under WhatItBroke surveillance...\n');

  // Timeline events: bootstrap, component creation, DI failure
  const timeline = core.getTimeline();
  timeline.clear();
  timeline.record('request_start', 'PlatformRef.bootstrapModule(AppModule)');
  timeline.recordComponentRender('DashboardComponent');
  timeline.record('undefined_value_detected', 'NullInjectorError: No provider for UserService!', {
    file: 'dashboard.component.ts',
    line: 12,
  });

  // Simulated Angular NullInjectorError
  const angularError = new Error(
    'NullInjectorError: R3InjectorError(AppModule)[DashboardComponent -> UserService]: NullInjectorError: No provider for UserService!'
  );
  angularError.name = 'NullInjectorError';
  angularError.stack = `NullInjectorError: R3InjectorError(AppModule)[DashboardComponent -> UserService]: NullInjectorError: No provider for UserService!
    at NullInjector.get (file:///node_modules/@angular/core/fesm2022/core.mjs:11242:27)
    at R3Injector.get (file:///node_modules/@angular/core/fesm2022/core.mjs:11412:33)
    at new DashboardComponent (file:///E:/afterquery/whatitbroke/examples/angular/dashboard.component.ts:12:15)`;

  const report = await adapter.analyzeAngularError(angularError, {
    componentName: 'DashboardComponent',
  });

  console.log(core.exportReport(report, 'cli'));
}

main().catch(console.error);
