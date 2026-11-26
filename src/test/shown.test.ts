import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Maytes } from '../index.js';
import { SHOWN_PATHS_KEY, SHOWN_URL, watchShown } from '../shown.js';
import { SDK_VERSION } from '../version.js';
import { resetMaytesDomForTests } from './reset-dom.js';
import type { MaytesEnvironment, MaytesSDK } from '../types.js';

class FakeObserver {
  static instances: FakeObserver[] = [];
  elements: Element[] = [];
  disconnected = false;

  constructor(
    private readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeObserver.instances.push(this);
  }

  observe(element: Element): void {
    this.elements.push(element);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  emit(intersectionRatio: number, isIntersecting = intersectionRatio > 0): void {
    this.deliver([{ intersectionRatio, isIntersecting } as IntersectionObserverEntry]);
  }

  emitTogether(...ratios: number[]): void {
    this.deliver(
      ratios.map(
        (intersectionRatio) =>
          ({ intersectionRatio, isIntersecting: intersectionRatio > 0 }) as IntersectionObserverEntry,
      ),
    );
  }

  private deliver(entries: IntersectionObserverEntry[]): void {
    if (this.disconnected) return;
    this.callback(entries, this as unknown as IntersectionObserver);
  }
}

let visibility: DocumentVisibilityState = 'visible';
let fetchSpy: ReturnType<typeof vi.fn>;
let instances: MaytesSDK[] = [];

function setVisibility(next: DocumentVisibilityState): void {
  visibility = next;
  document.dispatchEvent(new Event('visibilitychange'));
}

function makeInstance(environment: string = 'production'): MaytesSDK {
  const maytes = Maytes({
    createCheckout: async () => ({ checkoutId: 'x' }),
    environment: environment as MaytesEnvironment,
  });
  instances.push(maytes);
  return maytes;
}

function makeContainer(): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

function observerAt(index: number): FakeObserver {
  const observer = FakeObserver.instances[index];
  if (observer === undefined) throw new Error(`no observer at ${index}`);
  return observer;
}

beforeEach(() => {
  resetMaytesDomForTests();
  delete (window as unknown as Record<string, unknown>)[SHOWN_PATHS_KEY];
  window.history.pushState({}, '', '/');
  FakeObserver.instances = [];
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  fetchSpy = vi.fn(() => Promise.resolve(new Response()));
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  for (const maytes of instances) maytes.destroy();
  instances = [];
  document.body.replaceChildren();
  delete (document as unknown as Record<string, unknown>).visibilityState;
  vi.unstubAllGlobals();
});

describe('button shown report', () => {
  it('sends once, with the exact request, when half the button is on screen', () => {
    const container = makeContainer();
    makeInstance().renderButton(container);
    const observer = observerAt(0);

    expect(observer.options).toEqual({ threshold: 0.5 });
    expect(observer.elements).toEqual([container.querySelector('button')]);
    expect(fetchSpy).not.toHaveBeenCalled();

    observer.emit(0.5);
    observer.emit(1);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(`https://js.maytes.co/button-shown.txt?v=${SDK_VERSION}&env=production`, {
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'strict-origin',
      keepalive: true,
    });
    expect(SHOWN_URL).toBe('https://js.maytes.co/button-shown.txt');
    expect(observer.disconnected).toBe(true);
  });

  it.each(['production', 'sandbox', 'staging'])('sends from the %s environment and names it', (environment) => {
    makeInstance(environment).renderButton(makeContainer());
    observerAt(0).emit(1);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchSpy.mock.calls[0]?.[0]));
    expect(url.origin + url.pathname).toBe(SHOWN_URL);
    expect([...url.searchParams.keys()]).toEqual(['v', 'env']);
    expect(url.searchParams.get('v')).toBe(SDK_VERSION);
    expect(url.searchParams.get('env')).toBe(environment);
    expect(url.hash).toBe('');
  });

  it('reports a real version number', () => {
    expect(SDK_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it.each([
    ['less than half is on screen', 0.49, true],
    ['the button starts off screen', 0, false],
    ['the observer reports no intersection', 1, false],
  ])('sends nothing when %s', (_name, ratio, isIntersecting) => {
    makeInstance().renderButton(makeContainer());
    observerAt(0).emit(ratio, isIntersecting);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['arrived on screen', [0, 1], 1],
    ['left the screen', [1, 0], 0],
  ])('trusts the latest entry when the button %s within one callback', (_name, ratios, sent) => {
    makeInstance().renderButton(makeContainer());
    observerAt(0).emitTogether(...ratios);

    expect(fetchSpy).toHaveBeenCalledTimes(sent);
  });

  it('waits until a hidden page becomes visible', () => {
    visibility = 'hidden';
    makeInstance().renderButton(makeContainer());
    observerAt(0).emit(1);
    expect(fetchSpy).not.toHaveBeenCalled();

    setVisibility('visible');
    setVisibility('visible');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('sends nothing if the button left the screen before the page became visible', () => {
    visibility = 'hidden';
    makeInstance().renderButton(makeContainer());
    observerAt(0).emit(1);
    observerAt(0).emit(0, false);

    setVisibility('visible');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends once per path, however many buttons are shown', () => {
    const maytes = makeInstance();
    maytes.renderButton(makeContainer());
    maytes.renderButton(makeContainer());
    observerAt(0).emit(1);
    observerAt(1).emit(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    window.history.pushState({}, '', '/cart');
    maytes.renderButton(makeContainer());
    observerAt(2).emit(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    window.history.pushState({}, '', '/?utm=1#top');
    maytes.renderButton(makeContainer());
    observerAt(3).emit(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('shares what it already sent with another copy of the SDK', async () => {
    makeInstance().renderButton(makeContainer());
    observerAt(0).emit(1);

    vi.resetModules();
    const copy = await import('../shown.js');
    expect(copy.watchShown).not.toBe(watchShown);
    copy.watchShown(document.createElement('button'), 'production');
    observerAt(1).emit(1);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['the button cleanup', (maytes: MaytesSDK) => maytes.renderButton(makeContainer())()],
    [
      'destroy()',
      (maytes: MaytesSDK) => {
        maytes.renderButton(makeContainer());
        maytes.destroy();
      },
    ],
  ])('stops watching on %s', (_name, remove) => {
    visibility = 'hidden';
    const maytes = makeInstance();
    remove(maytes);

    expect(observerAt(0).disconnected).toBe(true);
    setVisibility('visible');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(['IntersectionObserver', 'fetch'])('renders the button when %s is missing', (name) => {
    vi.stubGlobal(name, undefined);
    const container = makeContainer();
    makeInstance().renderButton(container);

    expect(container.querySelector('button')).not.toBeNull();
    expect(FakeObserver.instances).toHaveLength(0);
  });

  it.each([
    [
      'the observer cannot be created',
      class {
        constructor() {
          throw new Error('nope');
        }
      },
    ],
    [
      'observing fails',
      class extends FakeObserver {
        override observe(): void {
          throw new Error('nope');
        }
      },
    ],
  ])('renders a removable button when %s', (_name, Observer) => {
    vi.stubGlobal('IntersectionObserver', Observer);
    const maytes = makeInstance();
    const container = makeContainer();

    expect(() => maytes.renderButton(container)).not.toThrow();
    expect(container.querySelector('button')).not.toBeNull();

    maytes.destroy();
    expect(container.querySelector('button')).toBeNull();
  });

  it.each([
    [
      'throws',
      () => {
        throw new Error('blocked');
      },
    ],
    ['rejects', () => Promise.reject(new Error('blocked'))],
    ['returns nothing', () => undefined],
  ])('stays quiet when fetch %s', async (_name, implementation) => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    vi.stubGlobal('fetch', () => {
      fetchSpy();
      return implementation();
    });
    makeInstance().renderButton(makeContainer());

    expect(() => observerAt(0).emit(1)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(unhandled).not.toHaveBeenCalled();
    process.off('unhandledRejection', unhandled);
  });

  it('still reports and removes the button when disconnecting the observer throws', () => {
    vi.stubGlobal(
      'IntersectionObserver',
      class extends FakeObserver {
        override disconnect(): void {
          throw new Error('nope');
        }
      },
    );
    const maytes = makeInstance();
    const container = makeContainer();
    maytes.renderButton(container);

    observerAt(0).emit(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    expect(() => maytes.destroy()).not.toThrow();
    expect(container.querySelector('button')).toBeNull();
  });

  it('swallows errors raised while handling what the observer saw', () => {
    (window as unknown as Record<string, unknown>)[SHOWN_PATHS_KEY] = 'not a set';
    makeInstance().renderButton(makeContainer());

    expect(() => observerAt(0).emit(1)).not.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
