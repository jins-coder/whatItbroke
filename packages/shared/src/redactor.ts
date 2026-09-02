/**
 * WhatItBroke - Privacy and Security Redaction Engine
 * Ensures credentials, tokens, cookies, PII, and secrets never leak.
 */

import { RedactionConfig } from './types.js';

export const DEFAULT_SENSITIVE_KEYS = [
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'apikey',
  'api_key',
  'api-key',
  'privatekey',
  'private_key',
  'client_secret',
  'jwt',
  'bearer',
  'creditcard',
  'credit_card',
  'cvv',
  'cvc',
  'ssn',
  'session',
  'sessionid',
  'session_id',
  'auth',
  'credentials',
  'database_url',
  'db_pass',
  'connection_string',
];

export const DEFAULT_SENSITIVE_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9\-_.]+/gi,
  /eyJ[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+/g, // JWT
  /AKIA[0-9A-Z]{16}/g, // AWS Access Key
  /[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}/g, // Credit Card pattern
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g, // Email pattern
];

export class Redactor {
  private keys: Set<string>;
  private patterns: RegExp[];
  private replacement: string;

  constructor(config?: RedactionConfig) {
    const customKeys = config?.keys || [];
    this.keys = new Set(
      [...DEFAULT_SENSITIVE_KEYS, ...customKeys].map((k) => k.toLowerCase())
    );
    this.patterns = [...DEFAULT_SENSITIVE_PATTERNS, ...(config?.patterns || [])];
    this.replacement = config?.replacement || '[REDACTED]';
  }

  public redact<T>(input: T): T {
    const seen = new WeakSet<object>();
    return this.sanitizeValue(input, seen, '') as T;
  }

  private sanitizeValue(value: unknown, seen: WeakSet<object>, keyName: string): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    // Check if the current key is sensitive
    if (keyName && this.isKeySensitive(keyName)) {
      return this.replacement;
    }

    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'function') {
      return `[Function: ${value.name || 'anonymous'}]`;
    }

    if (typeof value === 'symbol') {
      return value.toString();
    }

    if (typeof value === 'object') {
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);

      if (Array.isArray(value)) {
        return value.map((item) => this.sanitizeValue(item, seen, keyName));
      }

      if (value instanceof Date) {
        return value.toISOString();
      }

      if (value instanceof RegExp) {
        return value.toString();
      }

      if (value instanceof Error) {
        return {
          name: value.name,
          message: this.sanitizeString(value.message),
          stack: value.stack ? this.sanitizeString(value.stack) : undefined,
        };
      }

      // Plain or custom object
      const result: Record<string, unknown> = {};
      const entries = Object.entries(value);
      for (const [k, v] of entries) {
        if (this.isKeySensitive(k)) {
          result[k] = this.replacement;
        } else {
          result[k] = this.sanitizeValue(v, seen, k);
        }
      }
      return result;
    }

    return value;
  }

  public isKeySensitive(key: string): boolean {
    const normalized = key.toLowerCase().replace(/[-_]/g, '');
    for (const sensitive of this.keys) {
      const sensitiveNorm = sensitive.toLowerCase().replace(/[-_]/g, '');
      if (normalized === sensitiveNorm || normalized.includes(sensitiveNorm)) {
        return true;
      }
    }
    return false;
  }

  public sanitizeString(str: string): string {
    let result = str;

    // Redact basic URL user:pass@host passwords
    result = result.replace(/:\/\/([^:/]+):([^@]+)@/g, '://$1:[REDACTED]@');

    for (const pattern of this.patterns) {
      // Create new RegExp to avoid stateful lastIndex bugs
      const regex = new RegExp(pattern.source, pattern.flags);
      result = result.replace(regex, this.replacement);
    }
    return result;
  }
}

let defaultRedactorInstance: Redactor | null = null;

export function getRedactor(config?: RedactionConfig): Redactor {
  if (!config && defaultRedactorInstance) {
    return defaultRedactorInstance;
  }
  const instance = new Redactor(config);
  if (!config) {
    defaultRedactorInstance = instance;
  }
  return instance;
}

export function redact<T>(input: T, config?: RedactionConfig): T {
  return getRedactor(config).redact(input);
}
