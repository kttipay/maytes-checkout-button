import { vi } from 'vitest';

export interface FakeLocation {
  assignSpy: ReturnType<typeof vi.fn>;
  replaceSpy: ReturnType<typeof vi.fn>;
  restore(): void;
}

export function installFakeLocation(): FakeLocation {
  const originalLocation = window.location;
  const assignSpy = vi.fn();
  const replaceSpy = vi.fn();
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
  return {
    assignSpy,
    replaceSpy,
    restore() {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    },
  };
}
