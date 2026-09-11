import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { hideOverlay, showOverlay } from '../overlay.js';
import { createInstanceState, type InstanceState } from '../state.js';
import { ensureStylesInjected, resetStylesForTests } from '../styles.js';

function makeState(): InstanceState {
  return createInstanceState(
    { createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' },
    undefined,
  );
}

describe('overlay attachment', () => {
  let state: InstanceState;

  beforeEach(() => {
    resetStylesForTests();
    document.head.querySelectorAll('style[data-maytes-checkout-button-overlay-styles]').forEach((el) => el.remove());
    document.querySelectorAll('[data-maytes-overlay]').forEach((el) => el.remove());
    state = makeState();
    ensureStylesInjected(undefined);
  });

  afterEach(() => {
    hideOverlay(state);
    document.head.querySelectorAll('style[data-maytes-checkout-button-overlay-styles]').forEach((el) => el.remove());
  });

  it('hideOverlay is a no-op when no overlay was shown', () => {
    expect(() => hideOverlay(state)).not.toThrow();
    expect(state.overlayEl).toBeNull();
  });

  it('mounts the overlay to the local document when window.top === window', () => {
    expect(window.top).toBe(window);
    showOverlay(state);
    const overlay = document.querySelector('[data-maytes-overlay]');
    expect(overlay).not.toBeNull();
    expect(overlay?.parentElement).toBe(document.body);
  });

  it('mounts the overlay to the parent document when same-origin top frame is accessible', () => {
    const parentDoc = document.implementation.createHTMLDocument('parent');
    const originalTop = Object.getOwnPropertyDescriptor(window, 'top');
    Object.defineProperty(window, 'top', {
      configurable: true,
      get: () => ({ document: parentDoc } as unknown as Window),
    });
    try {
      showOverlay(state);
      const overlayInParent = parentDoc.querySelector('[data-maytes-overlay]');
      expect(overlayInParent).not.toBeNull();
      expect(overlayInParent?.ownerDocument).toBe(parentDoc);
      const clonedStyle = parentDoc.head.querySelector('style[data-maytes-checkout-button-overlay-styles]');
      expect(clonedStyle).not.toBeNull();
      expect(clonedStyle?.textContent).toContain('maytes-checkout-overlay');
    } finally {
      if (originalTop !== undefined) {
        Object.defineProperty(window, 'top', originalTop);
      } else {
        Object.defineProperty(window, 'top', { configurable: true, get: () => window });
      }
    }
  });

  it('falls back to local document when top.document access throws SecurityError', () => {
    const originalTop = Object.getOwnPropertyDescriptor(window, 'top');
    Object.defineProperty(window, 'top', {
      configurable: true,
      get: () => ({
        get document(): never {
          throw new DOMException('blocked', 'SecurityError');
        },
      } as unknown as Window),
    });
    try {
      expect(() => showOverlay(state)).not.toThrow();
      const overlay = document.querySelector('[data-maytes-overlay]');
      expect(overlay).not.toBeNull();
      expect(overlay?.ownerDocument).toBe(document);
    } finally {
      if (originalTop !== undefined) {
        Object.defineProperty(window, 'top', originalTop);
      } else {
        Object.defineProperty(window, 'top', { configurable: true, get: () => window });
      }
    }
  });
});
