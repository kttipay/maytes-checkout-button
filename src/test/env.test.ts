import { describe, it, expect } from 'vitest';
import { isValidEnvironment, resolveBaseUrl, type InternalEnvironment } from '../env.js';
import { MaytesError, MaytesErrorCode } from '../errors.js';

describe('isValidEnvironment', () => {
  it('returns true for "sandbox"', () => {
    expect(isValidEnvironment('sandbox')).toBe(true);
  });

  it('returns true for "production"', () => {
    expect(isValidEnvironment('production')).toBe(true);
  });

  it('returns true for "staging" (internal-only env)', () => {
    expect(isValidEnvironment('staging')).toBe(true);
  });

  it.each([
    ['dev', 'dev'],
    ['prod', 'prod'],
    ['live', 'live'],
    ['SANDBOX', 'SANDBOX (case-sensitive)'],
    ['Production', 'Production (case-sensitive)'],
    ['', 'empty string'],
  ])('returns false for %p (%s)', (value) => {
    expect(isValidEnvironment(value)).toBe(false);
  });

  const nonStringCases: Array<{ value: unknown; label: string }> = [
    { value: null, label: 'null' },
    { value: undefined, label: 'undefined' },
    { value: 0, label: 'number' },
    { value: false, label: 'boolean' },
    { value: {}, label: 'object' },
    { value: ['sandbox'], label: 'array' },
  ];
  it.each(nonStringCases)('returns false for non-string $label', ({ value }) => {
    expect(isValidEnvironment(value)).toBe(false);
  });

  it('narrows the TypeScript type', () => {
    const candidate: unknown = 'sandbox';
    if (isValidEnvironment(candidate)) {
      const narrowed: InternalEnvironment = candidate;
      expect(narrowed).toBe('sandbox');
    } else {
      expect.fail('expected narrowing to succeed');
    }
  });
});

describe('resolveBaseUrl', () => {
  it('maps sandbox to sandbox-checkout', () => {
    expect(resolveBaseUrl('sandbox', undefined)).toBe('https://sandbox-checkout.maytes.co');
  });

  it('maps production to checkout', () => {
    expect(resolveBaseUrl('production', undefined)).toBe('https://checkout.maytes.co');
  });

  it('does not leak the production URL into sandbox callers', () => {
    expect(resolveBaseUrl('sandbox', undefined)).not.toContain('//checkout.maytes.co');
  });

  it('returns the override when one is provided in sandbox', () => {
    expect(resolveBaseUrl('sandbox', 'https://dev-checkout-maytes.netlify.app'))
      .toBe('https://dev-checkout-maytes.netlify.app');
  });

  it('returns the override when one is provided in production', () => {
    expect(resolveBaseUrl('production', 'https://eu-checkout.maytes.co'))
      .toBe('https://eu-checkout.maytes.co');
  });

  it('treats empty-string override as a value, not "use default"', () => {
    expect(resolveBaseUrl('sandbox', '')).toBe('');
  });

  it('maps staging to staging-checkout (internal)', () => {
    expect(resolveBaseUrl('staging', undefined)).toBe('https://staging-checkout.maytes.co');
  });

  it('throws CONFIG when environment is somehow not in the map (defence-in-depth)', () => {
    expect(() => resolveBaseUrl('dev' as 'sandbox', undefined)).toThrow(MaytesError);
    try {
      resolveBaseUrl('dev' as 'sandbox', undefined);
      expect.fail('expected throw');
    } catch (e) {
      expect((e as MaytesError).code).toBe(MaytesErrorCode.Config);
    }
  });
});
