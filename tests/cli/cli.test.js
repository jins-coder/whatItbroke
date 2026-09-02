import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { runDoctor, runInit, runVerify, runAnalyze } from '../../packages/cli/dist/index.js';

test('CLI - runDoctor audits Node version and config', () => {
  const result = runDoctor(process.cwd());
  assert.equal(typeof result.passed, 'boolean');
  assert.ok(result.checks.some((c) => c.name === 'Node.js Version'));
  assert.ok(result.checks.some((c) => c.name === 'Privacy Engine'));
});

test('CLI - runInit dry-run scaffolds framework configuration', () => {
  const config = runInit({ cwd: process.cwd(), dryRun: true });
  assert.ok(config.framework);
  assert.ok(Array.isArray(config.adapters));
  assert.ok(config.redact.length > 0);
  assert.equal(config.ai.enabled, false);
});

test('CLI - runAnalyze parses error log and generates root cause report', async () => {
  const logContent = `TypeError: Cannot read properties of undefined (reading 'profile')
    at UserService.getProfile (src/services/user.service.ts:82:19)
    at UserController.handle (src/controllers/user.controller.ts:45:10)`;

  const reports = await runAnalyze({ target: logContent, cwd: process.cwd() });
  assert.ok(reports.length > 0);
  assert.equal(reports[0].context.error.name, 'TypeError');
  assert.equal(reports[0].affectedLocation.line, 82);
  assert.ok(reports[0].suggestedFix);
});

test('CLI - runVerify isolates patch in temporary sandbox and passes validation', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-test-'));
  const testFile = path.join(tempDir, 'user.service.ts');
  fs.writeFileSync(
    testFile,
    `export class UserService {
  getProfile(user: any) {
    return user.profile.name;
  }
}`
  );

  const result = await runVerify({ targetFile: testFile, cwd: tempDir });
  assert.equal(result.success, true);
  assert.equal(result.steps.length, 5);

  // Assert original file was NOT modified (production safety principle)
  const originalFileContent = fs.readFileSync(testFile, 'utf-8');
  assert.ok(originalFileContent.includes('user.profile.name'));

  // Clean up
  fs.rmSync(tempDir, { recursive: true, force: true });
});
