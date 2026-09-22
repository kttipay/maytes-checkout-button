import { describe, it, expect, beforeEach } from 'vitest';
import { ensureStylesInjected, releaseStyles, resetStylesForTests } from '../styles.js';

const SELECTOR = 'style[data-maytes-checkout-button]';

describe('styles ref-counting (direct, no button/DOM involved)', () => {
  beforeEach(() => {
    resetStylesForTests();
  });

  it('injects the style tag on the first call', () => {
    expect(document.head.querySelector(SELECTOR)).toBeNull();
    ensureStylesInjected(undefined);
    expect(document.head.querySelector(SELECTOR)).not.toBeNull();
  });

  it('only injects one style tag across repeated calls', () => {
    ensureStylesInjected(undefined);
    ensureStylesInjected(undefined);
    ensureStylesInjected(undefined);
    expect(document.head.querySelectorAll(SELECTOR).length).toBe(1);
  });

  it('removes the style tag once every consumer releases', () => {
    ensureStylesInjected(undefined);
    ensureStylesInjected(undefined);
    releaseStyles();
    expect(document.head.querySelector(SELECTOR)).not.toBeNull();
    releaseStyles();
    expect(document.head.querySelector(SELECTOR)).toBeNull();
  });

  it('clamps the ref-count at zero — an extra release does not create a phantom negative balance', () => {
    ensureStylesInjected(undefined);
    releaseStyles();
    releaseStyles();
    ensureStylesInjected(undefined);
    ensureStylesInjected(undefined);
    releaseStyles();
    expect(document.head.querySelector(SELECTOR)).not.toBeNull();
  });

  it('resetStylesForTests() fully resets ref-count and removes any injected tag', () => {
    ensureStylesInjected(undefined);
    ensureStylesInjected(undefined);
    resetStylesForTests();
    expect(document.head.querySelector(SELECTOR)).toBeNull();
    ensureStylesInjected(undefined);
    releaseStyles();
    expect(document.head.querySelector(SELECTOR)).toBeNull();
  });
});
