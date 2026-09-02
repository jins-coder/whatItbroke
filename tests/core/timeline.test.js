import test from 'node:test';
import assert from 'node:assert/strict';
import { TimelineRecorder } from '../../packages/core/dist/index.js';

test('TimelineRecorder - records events and maintains ring buffer limit', () => {
  const recorder = new TimelineRecorder(3); // max 3 events

  recorder.recordRequestStart('GET', '/api/v1/data');
  recorder.recordApiRequest('https://upstream.com/data', 'GET');
  recorder.recordApiResponse('https://upstream.com/data', 200, 45);
  recorder.recordException(new Error('Boom'), 'test.ts', 10);

  const events = recorder.getEvents();
  assert.equal(events.length, 3);
  // First event (/api/v1/data) should have dropped off the ring buffer
  assert.equal(events[0].type, 'api_request');
  assert.equal(events[1].type, 'api_response');
  assert.equal(events[2].type, 'exception');
  assert.equal(events[2].status, 'error');
});

test('TimelineRecorder - tracks database query events with null results', () => {
  const recorder = new TimelineRecorder();

  recorder.recordDbQuery('SELECT * FROM users WHERE id = 1', 12, true, 0);

  const events = recorder.getEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'db_query_end');
  assert.equal(events[0].status, 'warning');
  assert.equal(events[0].details.returnedNull, true);
});
