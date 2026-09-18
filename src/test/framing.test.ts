import { describe, expect, it, vi } from 'vitest';
import { isFramed, navigateTopLevel, sameOriginTop, viewportWidth } from '../framing.js';
import { crossOriginTopWindow, sameOriginTopWindow, withScreenWidth, withTop } from './framing-fakes.js';

describe('framing', () => {
  it('is not framed and measures its own window at top level', () => {
    expect(isFramed()).toBe(false);
    expect(sameOriginTop()).toBeNull();
    expect(viewportWidth()).toBe(window.innerWidth);
  });

  it('measures a same-origin top window instead of the frame', async () => {
    await withTop(sameOriginTopWindow(1280, () => undefined), async () => {
      expect(isFramed()).toBe(true);
      expect(sameOriginTop()).not.toBeNull();
      expect(viewportWidth()).toBe(1280);
    });
  });

  it('measures the screen when the top window is cross-origin', async () => {
    await withTop(crossOriginTopWindow(() => undefined), async () => {
      await withScreenWidth(390, async () => {
        expect(sameOriginTop()).toBeNull();
        expect(viewportWidth()).toBe(390);
      });
    });
  });

  it('falls back to its own width when the screen width is unknown', async () => {
    await withTop(crossOriginTopWindow(() => undefined), async () => {
      await withScreenWidth(0, async () => {
        expect(viewportWidth()).toBe(window.innerWidth);
      });
    });
  });

  it('navigates the top window and reports it', async () => {
    const topHref = vi.fn();
    await withTop(crossOriginTopWindow(topHref), async () => {
      expect(navigateTopLevel('https://checkout.maytes.co/?id=1', false)).toEqual({ target: 'top' });
      expect(topHref).toHaveBeenCalledWith('https://checkout.maytes.co/?id=1');
    });
  });

  it('opens a tab without an opener when the top window refuses', async () => {
    const originalOpen = window.open;
    await withTop(
      crossOriginTopWindow(() => {
        throw new DOMException('blocked', 'SecurityError');
      }),
      async () => {
        const tab = { opener: {} as unknown };
        const openSpy = vi.fn(() => tab as unknown as Window);
        window.open = openSpy as unknown as typeof window.open;
        try {
          expect(navigateTopLevel('https://checkout.maytes.co/?id=1', false)).toEqual({ target: 'tab' });
          expect(openSpy).toHaveBeenCalledWith('https://checkout.maytes.co/?id=1', '_blank');
          expect(tab.opener).toBeNull();
        } finally {
          window.open = originalOpen;
        }
      },
    );
  });

  it('reports the refusal when both the top window and a new tab are blocked', async () => {
    const originalOpen = window.open;
    const blocked = new DOMException('blocked', 'SecurityError');
    await withTop(
      crossOriginTopWindow(() => {
        throw blocked;
      }),
      async () => {
        window.open = vi.fn(() => null) as unknown as typeof window.open;
        try {
          expect(navigateTopLevel('https://checkout.maytes.co/?id=1', false)).toEqual({
            target: null,
            cause: blocked,
          });
        } finally {
          window.open = originalOpen;
        }
      },
    );
  });

  it('rethrows anything that is not a SecurityError', async () => {
    await withTop(
      {
        get document(): never {
          throw new TypeError('boom');
        },
      },
      async () => {
        expect(() => sameOriginTop()).toThrow(TypeError);
      },
    );
  });

  it('treats a SecurityError raised in another realm as a refusal of the top window', async () => {
    const foreignRealmSecurityError = Object.assign(new Error('blocked'), { name: 'SecurityError', code: 18 });
    const tab = { opener: {} as unknown };
    const originalOpen = window.open;
    window.open = vi.fn(() => tab as unknown as Window) as unknown as typeof window.open;
    try {
      await withTop(crossOriginTopWindow(() => { throw foreignRealmSecurityError; }), async () => {
        expect(navigateTopLevel('https://checkout.maytes.co/?id=1', false)).toEqual({ target: 'tab' });
      });
    } finally {
      window.open = originalOpen;
    }
  });

  it('treats a SecurityError raised in another realm as a cross-origin top window', async () => {
    const foreignRealmSecurityError = Object.assign(new Error('blocked'), { name: 'SecurityError', code: 18 });
    await withTop({ get document(): never { throw foreignRealmSecurityError; } }, async () => {
      expect(sameOriginTop()).toBeNull();
    });
  });
});
