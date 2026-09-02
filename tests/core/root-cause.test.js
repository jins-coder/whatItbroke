import test from 'node:test';
import assert from 'node:assert/strict';
import { RootCauseEngine, getCore } from '../../packages/core/dist/index.js';

test('RootCauseEngine - answers 4 questions for Node database null result failure', async () => {
  const core = getCore();
  const timeline = core.getTimeline();
  timeline.clear();
  timeline.recordRequestStart('GET', '/api/profile');
  timeline.recordDbQuery('SELECT * FROM users WHERE id = ?', 15, true, 0);

  const context = {
    id: 'test_node_db',
    timestamp: Date.now(),
    error: {
      name: 'TypeError',
      message: "Cannot read properties of null (reading 'profile')",
      timestamp: Date.now(),
    },
    source: {
      file: 'src/services/user.service.ts',
      line: 82,
      column: 19,
      functionName: 'UserService.getProfile()',
    },
    stack: [],
    runtime: { environment: 'node' },
    executionPath: [],
    timeline: timeline.getEvents(),
    database: {
      returnedNull: true,
      resultCount: 0,
      query: 'SELECT * FROM users WHERE id = ?',
    },
  };

  const report = RootCauseEngine.analyze(context);

  // 1. What broke?
  assert.ok(report.questionsAnswered.what.includes('TypeError'));
  // 2. Where did it break?
  assert.equal(report.affectedLocation.file, 'src/services/user.service.ts');
  assert.equal(report.affectedLocation.line, 82);
  // 3. Why did it break?
  assert.ok(report.rootCause.includes('null after the database query'));
  // 4. How can it be fixed?
  assert.ok(report.suggestedFix.title.includes('database result'));
  assert.ok(report.suggestedFix.explanation.includes('database query'));
  assert.ok(report.suggestedFix.suggestedPatch.includes('+'));
  assert.ok(report.confidenceScore >= 90);
});

test('RootCauseEngine - answers 4 questions for React unhandled async render failure', () => {
  const timeline = [
    { id: '1', timestamp: 100, type: 'api_request', summary: 'API request: GET /api/user' },
    { id: '2', timestamp: 102, type: 'component_render', summary: 'Component rendered: <UserProfile />' },
  ];

  const context = {
    id: 'test_react_render',
    timestamp: Date.now(),
    error: {
      name: 'TypeError',
      message: "Cannot read properties of undefined (reading 'name')",
      timestamp: Date.now(),
    },
    source: {
      file: 'UserProfile.tsx',
      line: 42,
      column: 20,
      functionName: 'UserProfile',
    },
    stack: [],
    runtime: { environment: 'browser' },
    executionPath: [],
    timeline,
    framework: {
      name: 'react',
      component: {
        name: 'UserProfile',
        renderPath: ['App', 'Dashboard', 'UserProfile'],
      },
    },
  };

  const report = RootCauseEngine.analyze(context);

  assert.ok(report.rootCause.includes('undefined during the initial render'));
  assert.equal(report.trigger, 'The API request has not completed.');
  assert.deepEqual(report.executionPath, [
    'App',
    'Dashboard',
    'UserProfile',
    'user.profile.name ❌',
  ]);
  assert.ok(report.suggestedFix.title.includes('loading / undefined state'));
  assert.ok(report.suggestedFix.explanation.includes('finished loading'));
  assert.ok(report.confidenceScore >= 90);
});

test('RootCauseEngine - identifies Angular NullInjectorError and recommends provider fix', () => {
  const context = {
    id: 'test_angular_di',
    timestamp: Date.now(),
    error: {
      name: 'NullInjectorError',
      message: 'NullInjectorError: No provider for UserService!',
      timestamp: Date.now(),
    },
    source: {
      file: 'dashboard.component.ts',
      line: 12,
      column: 5,
    },
    stack: [],
    runtime: { environment: 'browser' },
    executionPath: [],
    timeline: [],
    framework: {
      name: 'angular',
      component: { name: 'DashboardComponent' },
    },
  };

  const report = RootCauseEngine.analyze(context);

  assert.ok(report.rootCause.includes('No provider found for UserService'));
  assert.ok(report.suggestedFix.explanation.includes("@Injectable({ providedIn: 'root' })"));
  assert.ok(report.confidenceScore >= 95);
});
