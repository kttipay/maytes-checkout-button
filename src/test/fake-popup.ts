import { vi } from 'vitest';

export interface FakePopupLocation {
  href: string;
  replace: ReturnType<typeof vi.fn>;
}

export interface FakePopup {
  closed: boolean;
  focus: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  location: FakePopupLocation;
  document: Document;
}

export function makeFakePopup(): FakePopup {
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
