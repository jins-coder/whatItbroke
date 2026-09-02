/**
 * WhatItBroke - React Example Runner
 */

import { ReactAdapter } from '@whatitbroke/react';
import { getCore } from '@whatitbroke/core';

async function main() {
  const core = getCore();
  const adapter = new ReactAdapter(core);
  core.registerAdapter(adapter);

  console.log('Starting React Application under WhatItBroke surveillance...\n');

  // Timeline events: User navigates, request fired, component mounts, fails
  const timeline = core.getTimeline();
  timeline.clear();
  timeline.recordRequestStart('GET', '/');
  timeline.recordApiRequest('/api/user/me', 'GET');
  timeline.recordComponentRender('App');
  timeline.recordComponentRender('Dashboard');
  timeline.recordComponentRender('UserProfile');
  timeline.recordUndefinedDetected('user.profile', 'UserProfile.tsx', 42);

  // Simulated React component crash
  const reactError = new TypeError("Cannot read properties of undefined (reading 'name')");
  reactError.stack = `TypeError: Cannot read properties of undefined (reading 'name')
    at UserProfile (file:///E:/afterquery/whatitbroke/examples/react/UserProfile.tsx:42:25)
    at Dashboard (file:///E:/afterquery/whatitbroke/examples/react/UserProfile.tsx:50:10)
    at App (file:///E:/afterquery/whatitbroke/examples/react/UserProfile.tsx:54:10)`;

  const componentStack = `
    in UserProfile (created by Dashboard)
    in Dashboard (created by App)
    in App`;

  const report = await adapter.analyzeReactError(reactError, {
    componentName: 'UserProfile',
    componentStack,
    lifecyclePhase: 'render',
  });

  console.log(core.exportReport(report, 'cli'));
}

main().catch(console.error);
