import type { RedirectTarget } from './types.js';

export interface NavigationOutcome {
  target: RedirectTarget | null;
  cause?: unknown;
}

export function isSecurityError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'SecurityError';
}

export function isFramed(): boolean {
  return window.top !== null && window.top !== window;
}

export function sameOriginTop(): Window | null {
  if (!isFramed()) return null;
  const top = window.top as Window;
  try {
    void top.document;
    return top;
  } catch (err) {
    if (!isSecurityError(err)) throw err;
    return null;
  }
}

export function viewportWidth(): number {
  if (!isFramed()) return window.innerWidth;
  const top = sameOriginTop();
  if (top !== null) return top.innerWidth;
  const screenWidth = window.screen?.width;
  return typeof screenWidth === 'number' && screenWidth > 0 ? screenWidth : window.innerWidth;
}

function navigateWindow(target: Window, url: string, replace: boolean): void {
  if (replace) {
    target.location.replace(url);
  } else {
    target.location.href = url;
  }
}

function severOpener(tab: Window): void {
  try {
    tab.opener = null;
  } catch (err) {
    if (!isSecurityError(err)) throw err;
  }
}

export function navigateTopLevel(url: string, replace: boolean): NavigationOutcome {
  if (!isFramed()) {
    navigateWindow(window, url, replace);
    return { target: 'self' };
  }
  let refusal: unknown;
  try {
    navigateWindow(window.top as Window, url, replace);
    return { target: 'top' };
  } catch (err) {
    if (!isSecurityError(err)) throw err;
    refusal = err;
  }
  try {
    const tab = window.open(url, '_blank');
    if (tab !== null) {
      severOpener(tab);
      return { target: 'tab' };
    }
    return { target: null, cause: refusal };
  } catch (err) {
    return { target: null, cause: err };
  }
}
