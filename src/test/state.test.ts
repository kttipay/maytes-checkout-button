import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createInstanceState } from '../state.js';

describe('generatePopupName (via createInstanceState)', () => {
  let originalRandomUUID: typeof crypto.randomUUID;

  beforeEach(() => {
    originalRandomUUID = crypto.randomUUID;
  });

  afterEach(() => {
    crypto.randomUUID = originalRandomUUID;
  });

  it('uses crypto.randomUUID() when available', () => {
    const state = createInstanceState(
      { createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' },
      undefined,
    );
    expect(state.popupName).toMatch(/^maytes-checkout-[0-9a-f-]{36}$/);
  });

  it('falls back to a timestamp/random suffix when crypto.randomUUID is unavailable', () => {
    // @ts-expect-error -- simulating an environment without crypto.randomUUID
    crypto.randomUUID = undefined;
    const state = createInstanceState(
      { createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' },
      undefined,
    );
    expect(state.popupName).toMatch(/^maytes-checkout-[0-9a-z]+-[0-9a-z]+$/);
  });

  it('falls back when crypto.randomUUID throws', () => {
    crypto.randomUUID = vi.fn(() => { throw new Error('unsupported'); }) as typeof crypto.randomUUID;
    const state = createInstanceState(
      { createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' },
      undefined,
    );
    expect(state.popupName).toMatch(/^maytes-checkout-[0-9a-z]+-[0-9a-z]+$/);
  });

  it('produces a unique name on each call, even in the fallback path', () => {
    // @ts-expect-error -- simulating an environment without crypto.randomUUID
    crypto.randomUUID = undefined;
    const a = createInstanceState({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' }, undefined);
    const b = createInstanceState({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' }, undefined);
    expect(a.popupName).not.toBe(b.popupName);
  });
});

describe('createInstanceState config passthrough', () => {
  it('copies only createCheckout + environment when internal options are absent', () => {
    const createCheckout = async () => ({ checkoutId: 'x' });
    const state = createInstanceState({ createCheckout, environment: 'production' }, undefined);
    expect(state.config).toEqual({ createCheckout, environment: 'production' });
  });

  it('copies baseUrl and cspNonce onto config only when provided', () => {
    const createCheckout = async () => ({ checkoutId: 'x' });
    const state = createInstanceState(
      { createCheckout, environment: 'sandbox' },
      { baseUrl: 'https://example.com', cspNonce: 'nonce-1' },
    );
    expect(state.config.baseUrl).toBe('https://example.com');
    expect(state.config.cspNonce).toBe('nonce-1');
  });

  it('initializes busy/destroyed/popup/overlay/teardowns to their documented defaults', () => {
    const state = createInstanceState({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' }, undefined);
    expect(state.busy).toBe(false);
    expect(state.destroyed).toBe(false);
    expect(state.overlayEl).toBeNull();
    expect(state.overlayDetach).toBeNull();
    expect(state.popupWindow).toBeNull();
    expect(state.popupNavigated).toBe(false);
    expect(state.popupPollHandle).toBeNull();
    expect(state.teardowns).toEqual(new Set());
  });
});
