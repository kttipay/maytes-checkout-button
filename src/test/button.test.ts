import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Maytes, MaytesError, MaytesErrorCode, SDK_VERSION } from '../index.js';
import { foundation } from '../foundation/brand.generated.js';
import { POPUP_LOADING_CSS, resetStylesForTests } from '../styles.js';
import { crossOriginTopWindow, detailOf, sameOriginTopWindow, withScreenWidth, withTop } from './framing-fakes.js';
import type { MaytesSDK } from '../types.js';

interface FakePopupLocation {
  href: string;
  replace: ReturnType<typeof vi.fn>;
}

interface FakePopup {
  closed: boolean;
  focus: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  location: FakePopupLocation;
  document: Document;
}

function makeFakePopup(): FakePopup {
  const popupDoc = document.implementation.createHTMLDocument('maytes-popup');
  const location: FakePopupLocation = {
    href: 'about:blank',
    replace: vi.fn((url: string) => { location.href = url; }),
  };
  return {
    closed: false,
    focus: vi.fn(),
    close: vi.fn(function (this: FakePopup) { this.closed = true; }),
    location,
    document: popupDoc,
  };
}

function makeInstance(
  createCheckout = async () => ({ checkoutId: 'x' }),
  environment: 'sandbox' | 'production' = 'sandbox',
): MaytesSDK {
  return Maytes({ createCheckout, environment });
}

describe('maytes.renderButton', () => {
  let openSpy: ReturnType<typeof vi.fn>;
  let assignSpy: ReturnType<typeof vi.fn>;
  let originalOpen: typeof window.open;
  let originalLocation: Location;
  let container: HTMLElement;

  beforeEach(() => {
    resetStylesForTests();
    document.querySelectorAll('[data-maytes-overlay]').forEach((el) => el.remove());

    originalLocation = window.location;
    assignSpy = vi.fn();
    let currentHref = 'http://localhost/';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        get href() { return currentHref; },
        set href(v: string) { currentHref = v; assignSpy(v); },
        replace: (v: string) => { currentHref = v; },
      },
    });

    originalOpen = window.open;
    openSpy = vi.fn((_url?: string | URL, _name?: string, _features?: string) => makeFakePopup() as unknown as Window);
    window.open = openSpy as unknown as typeof window.open;

    container = document.createElement('div');
    document.body.appendChild(container);

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    window.open = originalOpen;
    container.remove();
    document.querySelectorAll('[data-maytes-overlay]').forEach((el) => el.remove());
  });

  it('throws CONFIG when container is not an HTMLElement', () => {
    const maytes = makeInstance();
    expect(() => maytes.renderButton(null as unknown as HTMLElement)).toThrow(MaytesError);
  });

  it('throws CONFIG after destroy()', () => {
    const maytes = makeInstance();
    maytes.destroy();
    try {
      maytes.renderButton(container);
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(MaytesError);
      expect((e as MaytesError).code).toBe(MaytesErrorCode.Config);
    }
  });

  it('throws CONFIG when mode is not redirect|popup', () => {
    const maytes = makeInstance();
    try {
      maytes.renderButton(container, { mode: 'inline' as unknown as 'popup' });
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(MaytesError);
      expect((e as MaytesError).code).toBe(MaytesErrorCode.Config);
    }
  });

  it('accepts mode: "redirect" and mode: "popup" without throwing', () => {
    const maytes = makeInstance();
    expect(() => maytes.renderButton(container, { mode: 'redirect' })).not.toThrow();
    const second = document.createElement('div');
    document.body.appendChild(second);
    expect(() => maytes.renderButton(second, { mode: 'popup' })).not.toThrow();
    second.remove();
  });

  it('POPUP_LOADING_CSS includes brand classes, reduced-motion guard, and slow-message rule', () => {
    expect(POPUP_LOADING_CSS).toContain('.maytes-popup-loading');
    expect(POPUP_LOADING_CSS).toContain('.maytes-popup-loading__spinner');
    expect(POPUP_LOADING_CSS).toContain('@media (prefers-reduced-motion: reduce)');
    expect(POPUP_LOADING_CSS).toContain('@keyframes maytes-checkout-button-spin');
    expect(POPUP_LOADING_CSS).toContain('.maytes-popup-loading__slow[hidden]');
    expect(POPUP_LOADING_CSS).toContain(foundation.brand.primary);
    expect(POPUP_LOADING_CSS).toContain(foundation.brand.secondary);
  });

  it('default mode opens a popup (no same-window redirect)', async () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    Maytes({ createCheckout: async () => ({ checkoutId: 'pop' }), environment: 'sandbox' })
      .renderButton(container);
    container.querySelector('button')!.click();
    expect(openSpy).toHaveBeenCalledOnce();
    expect(openSpy.mock.calls[0]?.[0]).toBe('about:blank');
    await vi.waitFor(() => expect(popup.location.replace).toHaveBeenCalled());
    expect(popup.location.replace).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=pop');
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("mode: 'redirect' navigates in the same window (no popup opened)", async () => {
    Maytes({ createCheckout: async () => ({ checkoutId: 'red' }), environment: 'sandbox' })
      .renderButton(container, { mode: 'redirect' });
    container.querySelector('button')!.click();
    await vi.waitFor(() => expect(assignSpy).toHaveBeenCalled());
    expect(assignSpy).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=red');
    expect(openSpy).not.toHaveBeenCalled();
    expect(document.querySelector('[data-maytes-overlay]')).toBeNull();
  });

  it('popup mode opens about:blank synchronously on click, before createCheckout resolves', async () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    let resolveCreate: (v: { checkoutId: string }) => void = () => {};
    const createCheckout = vi.fn(
      () => new Promise<{ checkoutId: string }>((resolve) => { resolveCreate = resolve; }),
    );
    Maytes({ createCheckout, environment: 'sandbox' }).renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();
    expect(openSpy).toHaveBeenCalledOnce();
    expect(openSpy.mock.calls[0]?.[0]).toBe('about:blank');
    expect(popup.location.replace).not.toHaveBeenCalled();
    resolveCreate({ checkoutId: 'ck_sync' });
    await vi.waitFor(() => expect(popup.location.replace).toHaveBeenCalled());
    expect(popup.location.replace).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=ck_sync');
    expect(openSpy).toHaveBeenCalledOnce();
  });

  it('paints the branded loading screen into the popup document with role=status', () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    Maytes({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' })
      .renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();
    expect(popup.document.documentElement.lang).toBe('en');
    expect(popup.document.body.classList.contains('maytes-popup-loading')).toBe(true);
    expect(popup.document.querySelector('.maytes-popup-loading__logo')).not.toBeNull();
    expect(popup.document.querySelector('[role="status"]')).not.toBeNull();
    expect(popup.document.querySelector('[aria-live="polite"]')).not.toBeNull();
    const style = popup.document.head.querySelector('style');
    expect(style?.textContent).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('popup mode still navigates if the popup document is not writable', async () => {
    const popup = makeFakePopup();
    Object.defineProperty(popup, 'document', { configurable: true, value: null });
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    Maytes({ createCheckout: async () => ({ checkoutId: 'docless' }), environment: 'sandbox' })
      .renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();
    await vi.waitFor(() => expect(popup.location.replace).toHaveBeenCalled());
    expect(popup.location.replace).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=docless');
  });

  it('applies cspNonce to the popup loading <style> when provided, none otherwise', () => {
    const popupA = makeFakePopup();
    const popupB = makeFakePopup();
    openSpy.mockReturnValueOnce(popupA as unknown as Window);
    Maytes(
      { createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' },
      { cspNonce: 'nonce-pop' },
    ).renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();
    expect(popupA.document.head.querySelector('style')?.getAttribute('nonce')).toBe('nonce-pop');

    openSpy.mockReturnValueOnce(popupB as unknown as Window);
    const second = document.createElement('div');
    document.body.appendChild(second);
    Maytes({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' })
      .renderButton(second, { mode: 'popup' });
    second.querySelector('button')!.click();
    expect(popupB.document.head.querySelector('style')?.hasAttribute('nonce')).toBe(false);
    second.remove();
  });

  it('reveals the slow-network message after ~8s while the popup is still loading', () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    Maytes({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' })
      .renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();
    const slow = popup.document.querySelector('.maytes-popup-loading__slow') as HTMLElement;
    expect(slow).not.toBeNull();
    expect(slow.hasAttribute('hidden')).toBe(true);
    vi.advanceTimersByTime(8000);
    expect(slow.hasAttribute('hidden')).toBe(false);
  });

  it('popup blocked: navigates same window and dispatches maytes:checkout-redirected (not failed)', async () => {
    openSpy.mockReturnValueOnce(null);
    const redirected = vi.fn();
    const failed = vi.fn();
    document.addEventListener('maytes:checkout-redirected', redirected);
    document.addEventListener('maytes:checkout-failed', failed);
    Maytes({ createCheckout: async () => ({ checkoutId: 'blk' }), environment: 'sandbox' })
      .renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();
    await vi.waitFor(() => expect(assignSpy).toHaveBeenCalled());
    expect(assignSpy).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=blk');
    expect(redirected).toHaveBeenCalledOnce();
    expect((redirected.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      url: 'https://sandbox-checkout.maytes.co/?id=blk',
      target: 'self',
    });
    expect(failed).not.toHaveBeenCalled();
    document.removeEventListener('maytes:checkout-redirected', redirected);
    document.removeEventListener('maytes:checkout-failed', failed);
  });

  it('popup mode behaves as same-window redirect on mobile', async () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    try {
      Maytes({ createCheckout: async () => ({ checkoutId: 'mob' }), environment: 'sandbox' })
        .renderButton(container, { mode: 'popup' });
      container.querySelector('button')!.click();
      await vi.waitFor(() => expect(assignSpy).toHaveBeenCalled());
      expect(assignSpy).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=mob');
      expect(openSpy).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    }
  });

  it('popup mode closes the orphan popup when createCheckout rejects', async () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    Maytes({ createCheckout: async () => { throw new Error('boom'); }, environment: 'sandbox' })
      .renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();
    await vi.waitFor(() => expect(popup.closed).toBe(true));
    expect(popup.location.replace).not.toHaveBeenCalled();
  });

  it('popup mode closes the pending popup on destroy without late navigation or opened event', async () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    let resolveCreate: (v: { checkoutId: string }) => void = () => {};
    const createCheckout = vi.fn(
      () => new Promise<{ checkoutId: string }>((resolve) => { resolveCreate = resolve; }),
    );
    const opened = vi.fn();
    document.addEventListener('maytes:checkout-opened', opened);
    const maytes = Maytes({ createCheckout, environment: 'sandbox' });
    maytes.renderButton(container, { mode: 'popup' });
    const button = container.querySelector('button')!;

    button.click();

    expect(openSpy).toHaveBeenCalledOnce();
    expect(openSpy.mock.calls[0]?.[0]).toBe('about:blank');
    expect(createCheckout).toHaveBeenCalledOnce();
    expect(opened).toHaveBeenCalledOnce();
    expect(button.getAttribute('aria-busy')).toBe('true');

    opened.mockClear();
    maytes.destroy();
    expect(popup.close).toHaveBeenCalledOnce();
    expect(popup.closed).toBe(true);
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();

    resolveCreate({ checkoutId: 'late' });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(popup.location.replace).not.toHaveBeenCalled();
    expect(opened).not.toHaveBeenCalled();
    expect(document.querySelector('[data-maytes-overlay]')).toBeNull();
    document.removeEventListener('maytes:checkout-opened', opened);
  });

  it('destroy() does not close a popup that already navigated to the checkout URL', async () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    const maytes = Maytes({ createCheckout: async () => ({ checkoutId: 'live' }), environment: 'sandbox' });
    maytes.renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();

    await vi.waitFor(() => expect(popup.location.replace).toHaveBeenCalledOnce());

    maytes.destroy();

    expect(popup.close).not.toHaveBeenCalled();
    expect(popup.closed).toBe(false);
  });

  it('popup mode closes the orphan popup when createCheckout returns invalid shape', async () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    Maytes({
      createCheckout: async () => ({ wrong: 'shape' } as unknown as { checkoutId: string }),
      environment: 'sandbox',
    }).renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();
    await vi.waitFor(() => expect(popup.closed).toBe(true));
    expect(popup.location.replace).not.toHaveBeenCalled();
  });

  it('does not navigate a popup the shopper already closed while createCheckout was in flight', async () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    let resolveCreate: (v: { checkoutId: string }) => void = () => {};
    const createCheckout = vi.fn(
      () => new Promise<{ checkoutId: string }>((resolve) => { resolveCreate = resolve; }),
    );
    const closed = vi.fn();
    const failed = vi.fn();
    document.addEventListener('maytes:checkout-closed', closed);
    document.addEventListener('maytes:checkout-failed', failed);

    Maytes({ createCheckout, environment: 'sandbox' }).renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();
    await vi.waitFor(() => expect(openSpy).toHaveBeenCalled());

    popup.close();
    vi.advanceTimersByTime(550);
    expect(closed).toHaveBeenCalledOnce();

    resolveCreate({ checkoutId: 'late' });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(popup.location.replace).not.toHaveBeenCalled();
    expect(closed).toHaveBeenCalledOnce();
    expect(failed).not.toHaveBeenCalled();
    document.removeEventListener('maytes:checkout-closed', closed);
    document.removeEventListener('maytes:checkout-failed', failed);
  });

  it('does not dispatch a second failed event when createCheckout rejects after the shopper already closed the popup', async () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    let rejectCreate: (err: Error) => void = () => {};
    const createCheckout = vi.fn(
      () => new Promise<{ checkoutId: string }>((_resolve, reject) => { rejectCreate = reject; }),
    );
    const closed = vi.fn();
    const failed = vi.fn();
    document.addEventListener('maytes:checkout-closed', closed);
    document.addEventListener('maytes:checkout-failed', failed);

    Maytes({ createCheckout, environment: 'sandbox' }).renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();
    await vi.waitFor(() => expect(openSpy).toHaveBeenCalled());

    popup.close();
    vi.advanceTimersByTime(550);
    expect(closed).toHaveBeenCalledOnce();

    rejectCreate(new Error('network down'));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(closed).toHaveBeenCalledOnce();
    expect(failed).not.toHaveBeenCalled();
    document.removeEventListener('maytes:checkout-closed', closed);
    document.removeEventListener('maytes:checkout-failed', failed);
  });

  it('appends a button into the container', () => {
    makeInstance().renderButton(container);
    const button = container.querySelector('button.maytes-checkout-button');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('type')).toBe('button');
  });

  it('injects styles once across multiple buttons (same instance)', () => {
    const maytes = makeInstance();
    maytes.renderButton(container);
    const second = document.createElement('div');
    document.body.appendChild(second);
    maytes.renderButton(second);
    expect(document.head.querySelectorAll('style[data-maytes-checkout-button]').length).toBe(1);
    second.remove();
  });

  it('injects styles once across multiple instances', () => {
    const a = makeInstance();
    const b = makeInstance();
    a.renderButton(container);
    const second = document.createElement('div');
    document.body.appendChild(second);
    b.renderButton(second);
    expect(document.head.querySelectorAll('style[data-maytes-checkout-button]').length).toBe(1);
    second.remove();
  });

  it('honors block: true with the modifier class', () => {
    makeInstance().renderButton(container, { block: true });
    expect(container.querySelector('button')?.className).toContain('maytes-checkout-button--block');
  });

  it('uses a custom label', () => {
    makeInstance().renderButton(container, { label: 'Pay with' });
    const button = container.querySelector('button');
    expect(button?.textContent).toContain('Pay with');
    expect(button?.getAttribute('aria-label')).toBe('Pay with Maytes');
  });

  it('invokes createCheckout on click and opens popup at sandbox URL (single navigation) + focus', async () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    const createCheckout = vi.fn(async () => ({ checkoutId: 'ck_123' }));
    Maytes({ createCheckout, environment: 'sandbox' }).renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();
    await vi.waitFor(() => expect(openSpy).toHaveBeenCalled());
    expect(createCheckout).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      'about:blank',
      expect.stringMatching(/^maytes-checkout-/),
      expect.stringMatching(/popup=yes.*width=500.*height=800/),
    );
    expect(openSpy).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(popup.location.replace).toHaveBeenCalled());
    expect(popup.location.replace).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=ck_123');
    expect(popup.location.href).toBe('https://sandbox-checkout.maytes.co/?id=ck_123');
    expect(popup.focus).toHaveBeenCalledOnce();
  });

  it('navigates the popup exactly once — no double-load of the checkout URL', async () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    Maytes({ createCheckout: async () => ({ checkoutId: 'once' }), environment: 'sandbox' })
      .renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();
    await vi.waitFor(() => expect(openSpy).toHaveBeenCalled());
    expect(openSpy).toHaveBeenCalledOnce();
    expect(openSpy.mock.calls[0]?.[0]).toBe('about:blank');
    await vi.waitFor(() => expect(popup.location.replace).toHaveBeenCalled());
    expect(popup.location.replace).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=once');
  });

  it('uses a unique per-instance popup window name (no cross-instance/tab collision)', async () => {
    const popupA = makeFakePopup();
    const popupB = makeFakePopup();
    openSpy.mockReturnValueOnce(popupA as unknown as Window);
    openSpy.mockReturnValueOnce(popupB as unknown as Window);
    const a = Maytes({ createCheckout: async () => ({ checkoutId: 'A' }), environment: 'sandbox' });
    const b = Maytes({ createCheckout: async () => ({ checkoutId: 'B' }), environment: 'sandbox' });
    const containerB = document.createElement('div');
    document.body.appendChild(containerB);
    a.renderButton(container, { mode: 'popup' });
    b.renderButton(containerB, { mode: 'popup' });
    container.querySelector('button')!.click();
    await vi.waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1));
    popupA.close();
    vi.advanceTimersByTime(550);
    containerB.querySelector('button')!.click();
    await vi.waitFor(() => expect(openSpy).toHaveBeenCalledTimes(2));
    const nameA = openSpy.mock.calls[0]?.[1] as string;
    const nameB = openSpy.mock.calls[1]?.[1] as string;
    expect(nameA).toMatch(/^maytes-checkout-/);
    expect(nameB).toMatch(/^maytes-checkout-/);
    expect(nameA).not.toBe('maytes-checkout');
    expect(nameA).not.toBe(nameB);
    containerB.remove();
  });

  it('reuses the same popup name across sequential checkouts on one instance', async () => {
    const p1 = makeFakePopup();
    const p2 = makeFakePopup();
    openSpy.mockReturnValueOnce(p1 as unknown as Window);
    openSpy.mockReturnValueOnce(p2 as unknown as Window);
    Maytes({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' })
      .renderButton(container, { mode: 'popup' });
    const button = container.querySelector('button')!;
    button.click();
    await vi.waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1));
    p1.close();
    vi.advanceTimersByTime(550);
    button.click();
    await vi.waitFor(() => expect(openSpy).toHaveBeenCalledTimes(2));
    expect(openSpy.mock.calls[0]?.[1]).toBe(openSpy.mock.calls[1]?.[1]);
  });

  it('opens at production URL when environment is production', async () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    Maytes({ createCheckout: async () => ({ checkoutId: 'ck_prod' }), environment: 'production' })
      .renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();
    await vi.waitFor(() => expect(popup.location.replace).toHaveBeenCalled());
    expect(popup.location.replace).toHaveBeenCalledWith('https://checkout.maytes.co/?id=ck_prod');
  });

  it('honors baseUrl override over environment mapping', async () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    Maytes(
      { createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' },
      { baseUrl: 'http://localhost:8080' },
    ).renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();
    await vi.waitFor(() => expect(popup.location.replace).toHaveBeenCalled());
    expect(popup.location.replace).toHaveBeenCalledWith('http://localhost:8080/?id=x');
  });

  it('uses checkoutUrl from createCheckout result verbatim when provided', async () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    Maytes({
      createCheckout: async () => ({
        checkoutId: 'local-abc',
        checkoutUrl: 'http://localhost:8080/?id=local-abc&mock=true',
      }),
      environment: 'sandbox',
    }, { baseUrl: 'http://example.invalid' }).renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();
    await vi.waitFor(() => expect(popup.location.replace).toHaveBeenCalled());
    expect(popup.location.replace).toHaveBeenCalledWith('http://localhost:8080/?id=local-abc&mock=true');
  });

  it('shows overlay while the popup is open and removes it when the popup closes', async () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    makeInstance().renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();
    await vi.waitFor(() => expect(openSpy).toHaveBeenCalled());
    expect(document.querySelectorAll('[data-maytes-overlay]').length).toBe(1);
    popup.close();
    vi.advanceTimersByTime(550);
    expect(document.querySelectorAll('[data-maytes-overlay]').length).toBe(0);
  });

  it('re-enables the button once the popup closes', async () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    makeInstance().renderButton(container, { mode: 'popup' });
    const button = container.querySelector('button')!;
    button.click();
    await vi.waitFor(() => expect(openSpy).toHaveBeenCalled());
    expect(button.getAttribute('aria-disabled')).toBe('true');
    popup.close();
    vi.advanceTimersByTime(550);
    expect(button.hasAttribute('aria-disabled')).toBe(false);
  });

  it('falls back to same-window redirect when window.open returns null', async () => {
    openSpy.mockReturnValueOnce(null);
    makeInstance().renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();
    await vi.waitFor(() => expect(assignSpy).toHaveBeenCalled());
    expect(assignSpy).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=x');
    expect(document.querySelectorAll('[data-maytes-overlay]').length).toBe(0);
  });

  it('ignores double-click while createCheckout is in flight', async () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    let resolveCreate: (v: { checkoutId: string }) => void = () => {};
    const createCheckout = vi.fn(
      () => new Promise<{ checkoutId: string }>((resolve) => { resolveCreate = resolve; }),
    );
    Maytes({ createCheckout, environment: 'sandbox' }).renderButton(container, { mode: 'popup' });
    const button = container.querySelector('button')!;
    button.click();
    button.click();
    button.click();
    expect(createCheckout).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    resolveCreate({ checkoutId: 'ck' });
    await vi.waitFor(() => expect(popup.location.replace).toHaveBeenCalled());
    expect(popup.location.replace).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=ck');
    expect(openSpy).toHaveBeenCalledOnce();
  });

  it('re-enables button and hides overlay when createCheckout rejects', async () => {
    Maytes({
      createCheckout: async () => { throw new Error('network down'); },
      environment: 'sandbox',
    }).renderButton(container, { mode: 'redirect' });
    const button = container.querySelector('button')!;
    button.click();
    await vi.waitFor(() => expect(button.hasAttribute('aria-disabled')).toBe(false));
    expect(document.querySelectorAll('[data-maytes-overlay]').length).toBe(0);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('re-enables button and hides overlay when createCheckout returns invalid shape', async () => {
    Maytes({
      createCheckout: async () => ({ wrong: 'shape' } as unknown as { checkoutId: string }),
      environment: 'sandbox',
    }).renderButton(container, { mode: 'redirect' });
    const button = container.querySelector('button')!;
    button.click();
    await vi.waitFor(() => expect(button.hasAttribute('aria-disabled')).toBe(false));
    expect(document.querySelectorAll('[data-maytes-overlay]').length).toBe(0);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('cleanup fn returned by renderButton removes the button and detaches listeners', async () => {
    const createCheckout = vi.fn(async () => ({ checkoutId: 'x' }));
    const maytes = Maytes({ createCheckout, environment: 'sandbox' });
    const cleanup = maytes.renderButton(container);
    const button = container.querySelector('button')!;
    cleanup();
    expect(container.querySelector('button')).toBeNull();
    button.click();
    await Promise.resolve();
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('cleanup removes injected style tag once the last button is gone', () => {
    const maytes = makeInstance();
    const a = maytes.renderButton(container);
    const second = document.createElement('div');
    document.body.appendChild(second);
    const b = maytes.renderButton(second);
    expect(document.head.querySelectorAll('style[data-maytes-checkout-button]').length).toBe(1);
    a();
    expect(document.head.querySelectorAll('style[data-maytes-checkout-button]').length).toBe(1);
    b();
    expect(document.head.querySelectorAll('style[data-maytes-checkout-button]').length).toBe(0);
    second.remove();
  });

  it('applies cspNonce to the injected style tag', () => {
    Maytes(
      { createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' },
      { cspNonce: 'nonce-abc' },
    ).renderButton(container);
    const style = document.head.querySelector('style[data-maytes-checkout-button]');
    expect(style?.getAttribute('nonce')).toBe('nonce-abc');
  });

  it('does not set nonce attribute when cspNonce is absent', () => {
    makeInstance().renderButton(container);
    const style = document.head.querySelector('style[data-maytes-checkout-button]');
    expect(style?.hasAttribute('nonce')).toBe(false);
  });

  it('cleanup is idempotent', () => {
    const cleanup = makeInstance().renderButton(container);
    cleanup();
    expect(() => cleanup()).not.toThrow();
    expect(document.head.querySelectorAll('style[data-maytes-checkout-button]').length).toBe(0);
  });

  it('default label is "Split with"', () => {
    makeInstance().renderButton(container);
    const button = container.querySelector('button')!;
    expect(button.textContent).toContain('Split with');
    expect(button.getAttribute('aria-label')).toBe('Split with Maytes');
  });

  it('block: false renders the inline pill', () => {
    makeInstance().renderButton(container, { block: false });
    const button = container.querySelector('button')!;
    expect(button.className).not.toContain('maytes-checkout-button--block');
    expect(button.className).toContain('maytes-checkout-button');
  });

  it('two independent instances use their own createCheckout closures', async () => {
    const popupA = makeFakePopup();
    const popupB = makeFakePopup();
    openSpy.mockReturnValueOnce(popupA as unknown as Window);
    openSpy.mockReturnValueOnce(popupB as unknown as Window);
    const a = Maytes({ createCheckout: async () => ({ checkoutId: 'A' }), environment: 'sandbox' });
    const b = Maytes({ createCheckout: async () => ({ checkoutId: 'B' }), environment: 'production' });
    const containerB = document.createElement('div');
    document.body.appendChild(containerB);
    a.renderButton(container, { mode: 'popup' });
    b.renderButton(containerB, { mode: 'popup' });
    container.querySelector('button')!.click();
    await vi.waitFor(() => expect(popupA.location.replace).toHaveBeenCalled());
    expect(popupA.location.replace).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=A');
    popupA.close();
    vi.advanceTimersByTime(550);
    containerB.querySelector('button')!.click();
    await vi.waitFor(() => expect(popupB.location.replace).toHaveBeenCalled());
    expect(popupB.location.replace).toHaveBeenCalledWith('https://checkout.maytes.co/?id=B');
    containerB.remove();
  });

  it('opened/closed events ordering in happy path', async () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    const order: string[] = [];
    const opened = () => order.push('opened');
    const closed = () => order.push('closed');
    document.addEventListener('maytes:checkout-opened', opened);
    document.addEventListener('maytes:checkout-closed', closed);
    makeInstance().renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();
    await vi.waitFor(() => expect(order).toContain('opened'));
    expect(order).toEqual(['opened']);
    popup.close();
    vi.advanceTimersByTime(550);
    expect(order).toEqual(['opened', 'closed']);
    document.removeEventListener('maytes:checkout-opened', opened);
    document.removeEventListener('maytes:checkout-closed', closed);
  });

  it('does NOT dispatch closed when createCheckout rejects (failed fires instead)', async () => {
    const opened = vi.fn();
    const closed = vi.fn();
    const failed = vi.fn();
    document.addEventListener('maytes:checkout-opened', opened);
    document.addEventListener('maytes:checkout-closed', closed);
    document.addEventListener('maytes:checkout-failed', failed);
    Maytes({
      createCheckout: async () => { throw new Error('nope'); },
      environment: 'sandbox',
    }).renderButton(container, { mode: 'redirect' });
    container.querySelector('button')!.click();
    await vi.waitFor(() => expect(failed).toHaveBeenCalled());
    expect(opened).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
    document.removeEventListener('maytes:checkout-opened', opened);
    document.removeEventListener('maytes:checkout-closed', closed);
    document.removeEventListener('maytes:checkout-failed', failed);
  });

  it('second click after rejection works (no leftover busy state)', async () => {
    let attempt = 0;
    const createCheckout = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('first fails');
      return { checkoutId: 'second' };
    });
    Maytes({ createCheckout, environment: 'sandbox' }).renderButton(container, { mode: 'redirect' });
    const button = container.querySelector('button')!;
    button.click();
    await vi.waitFor(() => expect(button.hasAttribute('aria-disabled')).toBe(false));
    button.click();
    await vi.waitFor(() => expect(assignSpy).toHaveBeenCalled());
    expect(assignSpy).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=second');
    expect(createCheckout).toHaveBeenCalledTimes(2);
  });

  it('shows the spinner again on a SECOND busy cycle, not just the first', async () => {
    let attempt = 0;
    const createCheckout = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('first fails');
      return { checkoutId: 'second' };
    });
    Maytes({ createCheckout, environment: 'sandbox' }).renderButton(container, { mode: 'redirect' });
    const button = container.querySelector('button')!;

    button.click();
    expect(button.querySelector('.maytes-checkout-button__spinner')).not.toBeNull();
    expect(button.querySelector('.maytes-checkout-button__logo')).toBeNull();
    await vi.waitFor(() => expect(button.hasAttribute('aria-disabled')).toBe(false));
    expect(button.querySelector('.maytes-checkout-button__logo')).not.toBeNull();
    expect(button.querySelector('.maytes-checkout-button__spinner')).toBeNull();

    button.click();
    expect(button.querySelector('.maytes-checkout-button__spinner')).not.toBeNull();
    expect(button.querySelector('.maytes-checkout-button__logo')).toBeNull();
    await vi.waitFor(() => expect(assignSpy).toHaveBeenCalled());
    expect(assignSpy).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=second');
  });

  it('destroy() tears down popup poll + overlay + removes buttons', () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    const maytes = makeInstance();
    maytes.renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();
    maytes.destroy();
    expect(container.querySelector('button')).toBeNull();
    expect(document.querySelectorAll('[data-maytes-overlay]').length).toBe(0);
    expect(popup.closed).toBe(true);
  });

  it('destroy is idempotent', () => {
    const maytes = makeInstance();
    maytes.renderButton(container);
    maytes.destroy();
    expect(() => maytes.destroy()).not.toThrow();
  });

  it('does not open a popup if destroy() is called while createCheckout is in flight', async () => {
    let resolveCreate: (v: { checkoutId: string }) => void = () => {};
    const createCheckout = vi.fn(
      () => new Promise<{ checkoutId: string }>((resolve) => { resolveCreate = resolve; }),
    );
    const maytes = Maytes({ createCheckout, environment: 'sandbox' });
    maytes.renderButton(container, { mode: 'redirect' });
    container.querySelector('button')!.click();
    expect(createCheckout).toHaveBeenCalledTimes(1);
    maytes.destroy();
    resolveCreate({ checkoutId: 'late' });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('destroy() removes each button click listener (no leak)', () => {
    const maytes = makeInstance();
    maytes.renderButton(container);
    const button = container.querySelector('button')!;
    const removeSpy = vi.spyOn(button, 'removeEventListener');
    maytes.destroy();
    expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('versions the injected style marker by SDK_VERSION', () => {
    makeInstance().renderButton(container);
    const style = document.head.querySelector('style[data-maytes-checkout-button]');
    expect(style?.getAttribute('data-maytes-checkout-button')).toBe(SDK_VERSION);
  });

  it('host-page spinner styles respect reduced motion', () => {
    makeInstance().renderButton(container);
    const style = document.head.querySelector('style[data-maytes-checkout-button]');
    expect(style?.textContent).toContain('@media (prefers-reduced-motion: reduce)');
    expect(style?.textContent).toContain('.maytes-checkout-overlay__spinner');
    expect(style?.textContent).toContain('.maytes-checkout-button__spinner');
  });

  it('clears the overlay immediately when the dialog is cancelled (Escape)', async () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    makeInstance().renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();
    await vi.waitFor(() => expect(document.querySelectorAll('[data-maytes-overlay]').length).toBe(1));
    const dialog = document.querySelector('[data-maytes-overlay]') as HTMLDialogElement;
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(document.querySelectorAll('[data-maytes-overlay]').length).toBe(0);
  });

  it('rejects a checkoutUrl that is not an http(s) URL (no javascript: popup)', async () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    const failed = vi.fn();
    document.addEventListener('maytes:checkout-failed', failed);
    Maytes({
      createCheckout: async () => ({ checkoutId: 'x', checkoutUrl: 'javascript:alert(1)' }),
      environment: 'sandbox',
    }).renderButton(container, { mode: 'popup' });
    const button = container.querySelector('button')!;
    button.click();
    await vi.waitFor(() => expect(button.hasAttribute('aria-disabled')).toBe(false));
    expect(openSpy).toHaveBeenCalledOnce();
    expect(popup.location.replace).not.toHaveBeenCalled();
    expect(popup.closed).toBe(true);
    expect(document.querySelectorAll('[data-maytes-overlay]').length).toBe(0);
    expect((failed.mock.calls[0]?.[0] as CustomEvent).detail.reason).toBe('invalid-shape');
    document.removeEventListener('maytes:checkout-failed', failed);
  });

  it('inside a same-origin iframe on a phone it navigates the top window, not the frame', async () => {
    const topHref = vi.fn();
    const redirected = vi.fn();
    document.addEventListener('maytes:checkout-redirected', redirected);
    await withTop(sameOriginTopWindow(390, topHref), async () => {
      Maytes({ createCheckout: async () => ({ checkoutId: 'frm' }), environment: 'sandbox' })
        .renderButton(container, { mode: 'popup' });
      container.querySelector('button')!.click();
      await vi.waitFor(() => expect(topHref).toHaveBeenCalled());
    });
    expect(topHref).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=frm');
    expect(assignSpy).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
    expect(detailOf(redirected)).toEqual({ url: 'https://sandbox-checkout.maytes.co/?id=frm', target: 'top' });
    document.removeEventListener('maytes:checkout-redirected', redirected);
  });

  it('inside a same-origin iframe the popup decision uses the top window width, not the frame width', async () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 340 });
    try {
      await withTop(sameOriginTopWindow(1280, () => undefined), async () => {
        makeInstance().renderButton(container, { mode: 'popup' });
        container.querySelector('button')!.click();
        await vi.waitFor(() => expect(openSpy).toHaveBeenCalled());
      });
      expect(openSpy).toHaveBeenCalledWith('about:blank', expect.stringMatching(/^maytes-checkout-/), expect.any(String));
      expect(assignSpy).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    }
  });

  it('inside a cross-origin iframe it navigates the top window when the browser allows it', async () => {
    const topHref = vi.fn();
    const redirected = vi.fn();
    document.addEventListener('maytes:checkout-redirected', redirected);
    await withScreenWidth(390, () => withTop(crossOriginTopWindow(topHref), async () => {
      makeInstance().renderButton(container);
      container.querySelector('button')!.click();
      await vi.waitFor(() => expect(topHref).toHaveBeenCalled());
    }));
    expect(topHref).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=x');
    expect(assignSpy).not.toHaveBeenCalled();
    expect(detailOf(redirected)).toEqual({ url: 'https://sandbox-checkout.maytes.co/?id=x', target: 'top' });
    document.removeEventListener('maytes:checkout-redirected', redirected);
  });

  it('inside a cross-origin iframe a refused top navigation opens the checkout in a new tab', async () => {
    const tab = { opener: {} as unknown };
    openSpy.mockReturnValueOnce(tab as unknown as Window);
    const redirected = vi.fn();
    const failed = vi.fn();
    document.addEventListener('maytes:checkout-redirected', redirected);
    document.addEventListener('maytes:checkout-failed', failed);
    await withScreenWidth(390, () => withTop(crossOriginTopWindow(() => { throw new DOMException('blocked', 'SecurityError'); }), async () => {
      makeInstance().renderButton(container);
      container.querySelector('button')!.click();
      await vi.waitFor(() => expect(openSpy).toHaveBeenCalled());
    }));
    expect(openSpy).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=x', '_blank');
    expect(tab.opener).toBeNull();
    expect(detailOf(redirected)).toEqual({ url: 'https://sandbox-checkout.maytes.co/?id=x', target: 'tab' });
    expect(failed).not.toHaveBeenCalled();
    document.removeEventListener('maytes:checkout-redirected', redirected);
    document.removeEventListener('maytes:checkout-failed', failed);
  });

  it('inside a cross-origin iframe with both ways out refused it fails loudly and re-enables the button', async () => {
    const blocked = new DOMException('blocked', 'SecurityError');
    openSpy.mockReturnValueOnce(null);
    const redirected = vi.fn();
    const failed = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    document.addEventListener('maytes:checkout-redirected', redirected);
    document.addEventListener('maytes:checkout-failed', failed);
    await withScreenWidth(390, () => withTop(crossOriginTopWindow(() => { throw blocked; }), async () => {
      makeInstance().renderButton(container);
      container.querySelector('button')!.click();
      await vi.waitFor(() => expect(failed).toHaveBeenCalled());
    }));
    expect(detailOf(failed)).toEqual({ reason: 'navigation-blocked', cause: blocked });
    expect(redirected).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
    expect(container.querySelector('button')!.getAttribute('aria-disabled')).toBeNull();
    expect(document.querySelectorAll('[data-maytes-overlay]').length).toBe(0);
    consoleError.mockRestore();
    document.removeEventListener('maytes:checkout-redirected', redirected);
    document.removeEventListener('maytes:checkout-failed', failed);
  });
});
