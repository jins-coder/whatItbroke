import test from 'node:test';
import assert from 'node:assert/strict';
import { StackParser } from '../../packages/core/dist/index.js';

test('StackParser - parses standard V8 stack traces', () => {
  const stack = `TypeError: Cannot read properties of undefined (reading 'name')
    at UserService.getProfile (E:/afterquery/whatitbroke/services/user.service.ts:82:19)
    at UserController.handle (E:/afterquery/whatitbroke/controllers/user.controller.ts:45:10)
    at async ExpressMiddleware.run (node_modules/express/lib/router.js:120:5)`;

  const frames = StackParser.parse(stack);

  assert.equal(frames.length, 3);
  assert.equal(frames[0].functionName, 'UserService.getProfile');
  assert.equal(frames[0].file, 'E:/afterquery/whatitbroke/services/user.service.ts');
  assert.equal(frames[0].line, 82);
  assert.equal(frames[0].column, 19);
  assert.equal(frames[0].isNodeModules, false);

  assert.equal(frames[2].isNodeModules, true);
  assert.equal(frames[2].isFrameworkInternal, true);
});

test('StackParser - parses Gecko and WebKit stack traces', () => {
  const stack = `getProfile@http://localhost:3000/src/user.service.ts:42:15
handleRequest@http://localhost:3000/src/controller.ts:18:22`;

  const frames = StackParser.parse(stack);

  assert.equal(frames.length, 2);
  assert.equal(frames[0].functionName, 'getProfile');
  assert.equal(frames[0].file, 'http://localhost:3000/src/user.service.ts');
  assert.equal(frames[0].line, 42);
  assert.equal(frames[0].column, 15);
});

test('StackParser - getPrimaryFrame filters out framework internals and node_modules', () => {
  const stack = `Error: crash
    at callInternal (node:internal/process/task_queues:95:5)
    at Object.renderWithHooks (node_modules/react-dom/cjs/react-dom.development.js:15486:18)
    at UserProfile (src/components/UserProfile.tsx:42:10)
    at App (src/App.tsx:12:5)`;

  const frames = StackParser.parse(stack);
  const primary = StackParser.getPrimaryFrame(frames);

  assert.ok(primary);
  assert.equal(primary.functionName, 'UserProfile');
  assert.equal(primary.file, 'src/components/UserProfile.tsx');
  assert.equal(primary.line, 42);
});
