import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceMapResolver } from '../../packages/core/dist/index.js';

test('SourceMapResolver - extracts context snippet with highlighted error line', () => {
  const fileContent = `line 1
line 2
line 3
const user = null;
const name = user.profile.name;
console.log(name);
line 7
line 8`;

  const snippet = SourceMapResolver.createSnippet(fileContent, 5, 20, 2);

  assert.equal(snippet.lines.length, 5); // lines 3, 4, 5, 6, 7
  assert.equal(snippet.lines[0].lineNumber, 3);
  assert.equal(snippet.lines[2].lineNumber, 5);
  assert.equal(snippet.lines[2].isErrorLine, true);
  assert.equal(snippet.lines[2].content, 'const name = user.profile.name;');
  assert.equal(snippet.lines[1].isErrorLine, false);
});

test('SourceMapResolver - extracts inline sourcemap base64 payload', () => {
  const mapObj = {
    version: 3,
    sources: ['src/original.ts'],
    names: [],
    mappings: 'AAAA',
    sourcesContent: ['export const orig = 42;'],
  };
  const base64 = Buffer.from(JSON.stringify(mapObj)).toString('base64');
  const fileWithMap = `console.log(42);\n//# sourceMappingURL=data:application/json;base64,${base64}`;

  const extracted = SourceMapResolver.extractInlineSourceMap(fileWithMap);

  assert.ok(extracted);
  assert.equal(extracted.version, 3);
  assert.equal(extracted.sources[0], 'src/original.ts');
  assert.equal(extracted.sourcesContent[0], 'export const orig = 42;');
});
