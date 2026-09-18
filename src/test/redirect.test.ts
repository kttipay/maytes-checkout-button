import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Maytes, MaytesError, MaytesErrorCode } from '../index.js';
import { withTop, crossOriginTopWindow } from './framing-fakes.js';

describe('maytes.checkoutUrl', () => {
  it('builds the URL with the sandbox base', () => {
    const maytes = Maytes({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' });
    expect(maytes.checkoutUrl({ checkoutId: 'abc-123' }))
      .toBe('https://sandbox-checkout.maytes.co/?id=abc-123');
  });

  it('builds the URL with the production base', () => {
    const maytes = Maytes({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'production' });
    expect(maytes.checkoutUrl({ checkoutId: 'abc' }))
      .toBe('https://checkout.maytes.co/?id=abc');
  });

  it('honors an internal baseUrl override', () => {
    const maytes = Maytes(
      { createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' },
      { baseUrl: 'https://example.com' },
    );
    expect(maytes.checkoutUrl({ checkoutId: 'abc' }))
      .toBe('https://example.com/?id=abc');
  });

  it('strips trailing slashes from baseUrl', () => {
    const maytes = Maytes(
      { createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' },
      { baseUrl: 'https://example.com///' },
    );
    expect(maytes.checkoutUrl({ checkoutId: 'abc' }))
      .toBe('https://example.com/?id=abc');
  });

  it('url-encodes the checkoutId', () => {
    const maytes = Maytes({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' });
    expect(maytes.checkoutUrl({ checkoutId: 'a b&c' }))
      .toBe('https://sandbox-checkout.maytes.co/?id=a%20b%26c');
  });

  it('throws MaytesError(CONFIG) on an empty checkoutId', () => {
    const maytes = Maytes({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' });
    expect(() => maytes.checkoutUrl({ checkoutId: '' })).toThrow(MaytesError);
    expect(() => maytes.checkoutUrl({ checkoutId: '   ' })).toThrow(MaytesError);
  });

  it('carries the CONFIG code on the thrown error', () => {
    const maytes = Maytes({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' });
    try {
      maytes.checkoutUrl({ checkoutId: '' });
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(MaytesError);
      expect((e as MaytesError).code).toBe(MaytesErrorCode.Config);
    }
  });
});

describe('maytes.redirectToCheckout', () => {
  let assignSpy: ReturnType<typeof vi.fn>;
  let replaceSpy: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
    assignSpy = vi.fn();
    replaceSpy = vi.fn();
    let currentHref = 'http://localhost/';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        get href() { return currentHref; },
        set href(v: string) { currentHref = v; assignSpy(v); },
        replace: (v: string) => { currentHref = v; replaceSpy(v); },
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('sets location.href by default', () => {
    const maytes = Maytes({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' });
    maytes.redirectToCheckout({ checkoutId: 'abc' });
    expect(assignSpy).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=abc');
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('uses location.replace when replace=true', () => {
    const maytes = Maytes({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'production' });
    maytes.redirectToCheckout({ checkoutId: 'abc', replace: true });
    expect(replaceSpy).toHaveBeenCalledWith('https://checkout.maytes.co/?id=abc');
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('throws MaytesError on bad input without redirecting', () => {
    const maytes = Maytes({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' });
    expect(() => maytes.redirectToCheckout({ checkoutId: '' })).toThrow(MaytesError);
    expect(assignSpy).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('inside a same-origin iframe it navigates the top window and honours replace', async () => {
    const topHref = vi.fn();
    const topReplace = vi.fn();
    const fakeTop = {
      document: document.implementation.createHTMLDocument('top'),
      innerWidth: 1280,
      location: { set href(v: string) { topHref(v); }, replace: topReplace },
    };
    await withTop(fakeTop, async () => {
      const maytes = Maytes({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' });
      maytes.redirectToCheckout({ checkoutId: 'abc' });
      maytes.redirectToCheckout({ checkoutId: 'def', replace: true });
    });
    expect(topHref).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=abc');
    expect(topReplace).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=def');
    expect(assignSpy).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('inside a cross-origin iframe it throws when neither the top window nor a tab can be opened', async () => {
    const originalOpen = window.open;
    window.open = vi.fn(() => null) as unknown as typeof window.open;
    try {
      await withTop(crossOriginTopWindow(() => { throw new DOMException('blocked', 'SecurityError'); }), async () => {
        const maytes = Maytes({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' });
        expect(() => maytes.redirectToCheckout({ checkoutId: 'abc' })).toThrow(MaytesError);
      });
    } finally {
      window.open = originalOpen;
    }
    expect(assignSpy).not.toHaveBeenCalled();
  });
});
