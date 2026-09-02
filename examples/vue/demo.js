/**
 * WhatItBroke - Vue 3 Example Runner
 */

import { VueAdapter } from '@whatitbroke/vue';
import { getCore } from '@whatitbroke/core';

async function main() {
  const core = getCore();
  const adapter = new VueAdapter(core);
  core.registerAdapter(adapter);

  console.log('Starting Vue Application under WhatItBroke surveillance...\n');

  // Timeline events: mount, state update, computed evaluation failure
  const timeline = core.getTimeline();
  timeline.clear();
  timeline.recordComponentRender('App');
  timeline.recordComponentRender('ProductList');
  timeline.recordStateUpdate('items', undefined, [{ id: '1', name: 'Item 1' }]);

  // Simulated Vue component setup reactivity error
  const vueError = new TypeError("Cannot read properties of undefined (reading 'value')");
  vueError.stack = `TypeError: Cannot read properties of undefined (reading 'value')
    at setup (file:///E:/afterquery/whatitbroke/examples/vue/ProductList.vue:10:17)
    at callWithErrorHandling (file:///node_modules/@vue/runtime-core/dist/runtime-core.esm-bundler.js:155:18)
    at setupStatefulComponent (file:///node_modules/@vue/runtime-core/dist/runtime-core.esm-bundler.js:7245:25)`;

  const report = await adapter.analyzeVueError(vueError, {
    componentName: 'ProductList',
    info: 'setup function',
    props: { items: undefined },
  });

  console.log(core.exportReport(report, 'cli'));
}

main().catch(console.error);
