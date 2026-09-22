import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { hideOverlay, showOverlay } from '../overlay.js';
import { createInstanceState, type InstanceState } from '../state.js';
import { ensureStylesInjected } from '../styles.js';
import { resetMaytesDomForTests } from './reset-dom.js';

function makeState(): InstanceState {
  return createInstanceState(
    { createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' },
    undefined,
  );
}

describe('overlay attachment', () => {
  let state: InstanceState;

  beforeEach(() => {
    resetMaytesDomForTests();
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

  it('removes the overlay from the parent document when this frame is navigated away', () => {
    const parentDoc = document.implementation.createHTMLDocument('parent');
    const originalTop = Object.getOwnPropertyDescriptor(window, 'top');
    Object.defineProperty(window, 'top', {
      configurable: true,
      get: () => ({ document: parentDoc } as unknown as Window),
    });
    try {
      showOverlay(state);
      expect(parentDoc.querySelector('[data-maytes-overlay]')).not.toBeNull();
      window.dispatchEvent(new Event('pagehide'));
      expect(parentDoc.querySelector('[data-maytes-overlay]')).toBeNull();
      expect(parentDoc.head.querySelector('style[data-maytes-checkout-button-overlay-styles]')).toBeNull();
      expect(state.overlayEl).toBeNull();
    } finally {
      if (originalTop !== undefined) {
        Object.defineProperty(window, 'top', originalTop);
      } else {
        Object.defineProperty(window, 'top', { configurable: true, get: () => window });
      }
    }
  });

  it('stops listening for pagehide once the overlay is hidden', () => {
    const parentDoc = document.implementation.createHTMLDocument('parent');
    const originalTop = Object.getOwnPropertyDescriptor(window, 'top');
    Object.defineProperty(window, 'top', {
      configurable: true,
      get: () => ({ document: parentDoc } as unknown as Window),
    });
    try {
      showOverlay(state);
      hideOverlay(state);
      showOverlay(state);
      const second = parentDoc.querySelector('[data-maytes-overlay]');
      expect(second).not.toBeNull();
      window.dispatchEvent(new Event('pagehide'));
      expect(parentDoc.querySelector('[data-maytes-overlay]')).toBeNull();
      expect(state.overlayEl).toBeNull();
    } finally {
      if (originalTop !== undefined) {
        Object.defineProperty(window, 'top', originalTop);
      } else {
        Object.defineProperty(window, 'top', { configurable: true, get: () => window });
      }
    }
  });

  it('showOverlay is idempotent — calling it twice while shown does not create a second dialog', () => {
    showOverlay(state);
    showOverlay(state);
    expect(document.querySelectorAll('[data-maytes-overlay]').length).toBe(1);
  });

  it('falls back to inline open + backdrop when dialog.showModal is unavailable', () => {
    showOverlay(state);
    const dialog = document.querySelector('[data-maytes-overlay]') as HTMLDialogElement;
    expect(typeof dialog.showModal).not.toBe('function');
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.style.background).toBe('rgba(0, 0, 0, 0.6)');
  });

  it('falls back to inline open + backdrop when dialog.showModal throws', () => {
    const proto = HTMLDialogElement.prototype as unknown as { showModal?: () => void };
    proto.showModal = () => { throw new DOMException('not supported here', 'InvalidStateError'); };
    try {
      showOverlay(state);
      const dialog = document.querySelector('[data-maytes-overlay]') as HTMLDialogElement;
      expect(dialog.hasAttribute('open')).toBe(true);
      expect(dialog.style.background).toBe('rgba(0, 0, 0, 0.6)');
    } finally {
      delete proto.showModal;
    }
  });

  it('"Return to Maytes" link refocuses the popup when it is open and not closed', () => {
    showOverlay(state);
    const fakePopup = { closed: false, focus: vi.fn() } as unknown as Window;
    state.popupWindow = fakePopup;
    const link = document.querySelector('.maytes-checkout-overlay__link') as HTMLButtonElement;
    link.click();
    expect((fakePopup as unknown as { focus: ReturnType<typeof vi.fn> }).focus).toHaveBeenCalledOnce();
  });

  it('"Return to Maytes" link is a no-op when there is no open popup', () => {
    showOverlay(state);
    const link = document.querySelector('.maytes-checkout-overlay__link') as HTMLButtonElement;

    state.popupWindow = null;
    expect(() => link.click()).not.toThrow();

    const closedPopup = { closed: true, focus: vi.fn() } as unknown as Window;
    state.popupWindow = closedPopup;
    link.click();
    expect((closedPopup as unknown as { focus: ReturnType<typeof vi.fn> }).focus).not.toHaveBeenCalled();
  });

  it('does not clone the button-style tag again if the top document already carries the marker', () => {
    const parentDoc = document.implementation.createHTMLDocument('parent');
    const existingMarker = parentDoc.createElement('style');
    existingMarker.setAttribute('data-maytes-checkout-button-overlay-styles', '');
    existingMarker.textContent = '/* pre-existing */';
    parentDoc.head.appendChild(existingMarker);

    const originalTop = Object.getOwnPropertyDescriptor(window, 'top');
    Object.defineProperty(window, 'top', {
      configurable: true,
      get: () => ({ document: parentDoc } as unknown as Window),
    });
    try {
      showOverlay(state);
      const clones = parentDoc.head.querySelectorAll('style[data-maytes-checkout-button-overlay-styles]');
      expect(clones.length).toBe(1);
      expect(clones[0]?.textContent).toBe('/* pre-existing */');
    } finally {
      if (originalTop !== undefined) {
        Object.defineProperty(window, 'top', originalTop);
      } else {
        Object.defineProperty(window, 'top', { configurable: true, get: () => window });
      }
    }
  });

  it('hideOverlay removes the cloned cross-frame style tag', () => {
    const parentDoc = document.implementation.createHTMLDocument('parent');
    const originalTop = Object.getOwnPropertyDescriptor(window, 'top');
    Object.defineProperty(window, 'top', {
      configurable: true,
      get: () => ({ document: parentDoc } as unknown as Window),
    });
    try {
      showOverlay(state);
      expect(parentDoc.head.querySelector('style[data-maytes-checkout-button-overlay-styles]')).not.toBeNull();
      hideOverlay(state);
      expect(parentDoc.head.querySelector('style[data-maytes-checkout-button-overlay-styles]')).toBeNull();
    } finally {
      if (originalTop !== undefined) {
        Object.defineProperty(window, 'top', originalTop);
      } else {
        Object.defineProperty(window, 'top', { configurable: true, get: () => window });
      }
    }
  });
});
