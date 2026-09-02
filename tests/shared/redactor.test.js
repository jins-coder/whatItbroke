import test from 'node:test';
import assert from 'node:assert/strict';
import { Redactor, redact, DEFAULT_SENSITIVE_KEYS } from '../../packages/shared/dist/index.js';

test('Redactor - redacts default sensitive keys in plain objects', () => {
  const redactor = new Redactor();
  const input = {
    username: 'alice',
    password: 'superSecretPassword123!',
    authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    cookie: 'session=987654321',
    token: 'ghp_abcdefghijklmnopqrstuvwxyz',
    apiKey: 'my_api_key_xyz',
    publicData: 'unrestricted',
  };

  const output = redactor.redact(input);

  assert.equal(output.username, 'alice');
  assert.equal(output.password, '[REDACTED]');
  assert.equal(output.authorization, '[REDACTED]');
  assert.equal(output.cookie, '[REDACTED]');
  assert.equal(output.token, '[REDACTED]');
  assert.equal(output.apiKey, '[REDACTED]');
  assert.equal(output.publicData, 'unrestricted');
});

test('Redactor - redacts Bearer tokens and JWT patterns inside strings', () => {
  const redactor = new Redactor();
  const rawStr = 'Header sent with Bearer 12345abcdef and token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0mX3bB3v8Z_hR2_2c';
  const sanitized = redactor.sanitizeString(rawStr);

  assert.ok(!sanitized.includes('12345abcdef'));
  assert.ok(!sanitized.includes('dozjgNryP4J3jVmNHl0w5N'));
  assert.ok(sanitized.includes('[REDACTED]'));
});

test('Redactor - handles circular references safely without infinite recursion', () => {
  const redactor = new Redactor();
  const objA = { name: 'NodeA' };
  const objB = { name: 'NodeB', link: objA };
  objA.link = objB;

  const result = redactor.redact(objA);
  assert.equal(result.name, 'NodeA');
  assert.equal(result.link.name, 'NodeB');
  assert.equal(result.link.link, '[Circular Reference]');
});

test('Redactor - redacts passwords embedded in database / HTTP URLs', () => {
  const redactor = new Redactor();
  const dbUrl = 'postgres://admin:super_secret_db_pass@db.example.com:5432/production';
  const sanitized = redactor.sanitizeString(dbUrl);

  assert.ok(!sanitized.includes('super_secret_db_pass'));
  assert.ok(sanitized.includes('admin:[REDACTED]@db.example.com'));
});

test('Redactor - supports custom sensitive keys and patterns', () => {
  const customRedactor = new Redactor({
    keys: ['internalSecretField'],
    replacement: '<HIDDEN>',
  });

  const output = customRedactor.redact({
    internalSecretField: 'classified',
    normal: 'hello',
  });

  assert.equal(output.internalSecretField, '<HIDDEN>');
  assert.equal(output.normal, 'hello');
});
