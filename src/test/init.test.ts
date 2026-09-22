import { describe, it, expect } from 'vitest';
import { Maytes, MaytesError, MaytesErrorCode } from '../index.js';
import type { MaytesOptions } from '../index.js';

describe('Maytes() factory', () => {
  it('returns an SDK instance when given valid options', () => {
    const maytes = Maytes({
      createCheckout: async () => ({ checkoutId: 'abc' }),
      environment: 'sandbox',
    });
    expect(typeof maytes.renderButton).toBe('function');
    expect(typeof maytes.redirectToCheckout).toBe('function');
    expect(typeof maytes.checkoutUrl).toBe('function');
    expect(typeof maytes.destroy).toBe('function');
  });

  it('accepts production environment', () => {
    const maytes = Maytes({
      createCheckout: async () => ({ checkoutId: 'x' }),
      environment: 'production',
    });
    expect(maytes.checkoutUrl({ checkoutId: 'y' })).toBe('https://checkout.maytes.co/?id=y');
  });

  it('throws CONFIG when createCheckout is missing', () => {
    expect(() =>
      Maytes({
        createCheckout: undefined as unknown as () => Promise<{ checkoutId: string }>,
        environment: 'sandbox',
      }),
    ).toThrow(MaytesError);
  });

  it('throws CONFIG when createCheckout is not a function', () => {
    try {
      Maytes({
        createCheckout: 'nope' as unknown as () => Promise<{ checkoutId: string }>,
        environment: 'sandbox',
      });
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(MaytesError);
      expect((e as MaytesError).code).toBe(MaytesErrorCode.Config);
    }
  });

  it('throws CONFIG when environment is invalid', () => {
    expect(() =>
      Maytes({
        createCheckout: async () => ({ checkoutId: 'x' }),
        environment: 'dev' as 'sandbox',
      }),
    ).toThrow(MaytesError);
  });

  it('routes the internal staging env to staging-checkout (cast required)', () => {
    const maytes = Maytes({
      createCheckout: async () => ({ checkoutId: 'x' }),
      environment: 'staging' as 'sandbox',
    });
    expect(maytes.checkoutUrl({ checkoutId: 'y' })).toBe('https://staging-checkout.maytes.co/?id=y');
  });

  it('throws CONFIG eagerly when baseUrl is malformed', () => {
    expect(() =>
      Maytes(
        { createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' },
        { baseUrl: 'not a url' },
      ),
    ).toThrow(MaytesError);
  });

  it('throws CONFIG eagerly when baseUrl uses a non-http(s) scheme', () => {
    expect(() =>
      Maytes(
        { createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' },
        { baseUrl: 'javascript:alert(1)' },
      ),
    ).toThrow(MaytesError);
  });

  it('returns independent instances on each call', () => {
    const a = Maytes({ createCheckout: async () => ({ checkoutId: '1' }), environment: 'sandbox' });
    const b = Maytes({ createCheckout: async () => ({ checkoutId: '2' }), environment: 'production' });
    expect(a).not.toBe(b);
    expect(a.checkoutUrl({ checkoutId: 'x' })).toContain('sandbox-checkout');
    expect(b.checkoutUrl({ checkoutId: 'x' })).toBe('https://checkout.maytes.co/?id=x');
  });

  it('throws CONFIG when options itself is not an object (null, undefined, or a primitive)', () => {
    expect(() => Maytes(null as unknown as MaytesOptions)).toThrow(MaytesError);
    expect(() => Maytes(undefined as unknown as MaytesOptions)).toThrow(MaytesError);
    expect(() => Maytes('nope' as unknown as MaytesOptions)).toThrow(MaytesError);
    expect(() => Maytes(42 as unknown as MaytesOptions)).toThrow(MaytesError);
  });
});
