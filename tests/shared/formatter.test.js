import test from 'node:test';
import assert from 'node:assert/strict';
import { colors, formatReportCLI } from '../../packages/shared/dist/index.js';

test('Formatter - colors and report formatter evaluate cleanly', () => {
  assert.ok(colors);
  assert.equal(typeof colors.reset, 'string');
  assert.equal(typeof colors.red, 'string');

  const dummyReport = {
    headline: 'Dummy error headline',
    affectedLocation: {
      file: 'src/components/MyComp.vue',
      line: 42,
      column: 10,
    },
    rootCause: 'Reactivity loss on props',
    suggestedFix: {
      explanation: 'Use toRefs(props)',
    },
    context: {
      error: { name: 'TypeError', message: 'test' },
      runtime: { environment: 'browser' },
    },
  };

  const output = formatReportCLI(dummyReport);
  assert.ok(output.includes('WHAT IT BROKE'));
  assert.ok(output.includes('src/components/MyComp.vue:42:10'));
});
