import type { Mock } from 'vitest';

export async function withTop(fakeTop: unknown, run: () => Promise<void>): Promise<void> {
  const originalTop = Object.getOwnPropertyDescriptor(window, 'top');
  Object.defineProperty(window, 'top', { configurable: true, get: () => fakeTop as Window });
  try {
    await run();
  } finally {
    if (originalTop !== undefined) {
      Object.defineProperty(window, 'top', originalTop);
    } else {
      Object.defineProperty(window, 'top', { configurable: true, get: () => window });
    }
  }
}

export async function withScreenWidth(width: number, run: () => Promise<void>): Promise<void> {
  const originalScreen = Object.getOwnPropertyDescriptor(window, 'screen');
  Object.defineProperty(window, 'screen', { configurable: true, value: { width, height: 800 } });
  try {
    await run();
  } finally {
    if (originalScreen !== undefined) Object.defineProperty(window, 'screen', originalScreen);
  }
}

export function sameOriginTopWindow(innerWidth: number, hrefSetter: (url: string) => void) {
  return {
    innerWidth,
    document: document.implementation.createHTMLDocument('top'),
    location: { set href(v: string) { hrefSetter(v); }, replace: (v: string) => hrefSetter(v) },
  };
}

export function crossOriginTopWindow(hrefSetter: (url: string) => void) {
  return {
    get document(): never { throw new DOMException('blocked', 'SecurityError'); },
    get innerWidth(): never { throw new DOMException('blocked', 'SecurityError'); },
    location: { set href(v: string) { hrefSetter(v); }, replace: (v: string) => hrefSetter(v) },
  };
}

export function detailOf(listener: Mock): unknown {
  return (listener.mock.calls[0]?.[0] as CustomEvent).detail;
}
