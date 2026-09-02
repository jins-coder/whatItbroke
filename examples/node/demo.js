/**
 * WhatItBroke - Node.js Example Runner
 */

import { NodeAdapter, DbTracker, HttpTracker } from '@whatitbroke/node';
import { getCore } from '@whatitbroke/core';
import { Database, UserService } from './user.service.js';

async function main() {
  const core = getCore();
  const adapter = new NodeAdapter(core);
  core.registerAdapter(adapter);

  console.log('Starting Node.js Application with WhatItBroke surveillance...\n');

  // Simulate incoming HTTP request
  const netContext = {
    method: 'GET',
    url: '/api/profile',
    route: '/api/profile',
    headers: {
      authorization: 'Bearer secret_super_token_12345',
      cookie: 'session_id=abcdef123456',
    },
  };
  HttpTracker.setContext(netContext);
  core.getTimeline().recordRequestStart('GET', '/api/profile');

  // Record simulated execution path steps
  adapter.addExecutionStep({
    category: 'request',
    name: 'GET /api/profile',
    description: 'Incoming HTTP request dispatch',
  });
  adapter.addExecutionStep({
    category: 'controller',
    name: 'UserController',
    description: 'Dispatching to UserController.getProfile',
  });
  adapter.addExecutionStep({
    category: 'service',
    name: 'UserService.getProfile()',
    description: 'Executing UserService.getProfile',
  });

  try {
    // Wrap database query with DbTracker to catch null return
    await DbTracker.trackQuery(
      'SELECT * FROM users WHERE id = ?',
      ['usr_987'],
      async () => {
        return Database.query('SELECT * FROM users WHERE id = ?', ['usr_987']);
      },
      { system: 'postgres', table: 'users' }
    );

    // Call service which fails
    await UserService.getProfile('usr_987');
  } catch (err) {
    // WhatItBroke analyzes the crash
    const report = await core.analyze(err);

    // Output CLI format
    console.log(core.exportReport(report, 'cli'));

    // Output Timeline
    console.log(core.exportReport(report, 'html') ? '✔ Generated HTML report available' : '');
  }
}

main().catch(console.error);
