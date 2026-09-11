import { foundation } from './foundation/brand.generated.js';
import { SDK_VERSION } from './version.js';

const STYLE_ATTR = 'data-maytes-checkout-button';
const STYLE_SELECTOR = `style[${STYLE_ATTR}="${SDK_VERSION}"]`;
const REFCOUNT_KEY = `__maytes_checkout_button_styles_refs_${SDK_VERSION}__`;

interface RefCountWindow extends Window {
  [REFCOUNT_KEY]?: number;
}

// WEB-LOCAL: no foundation role (a11y focus ring); see MOB-994
const FOCUS_RING = '#6b8aff';

const BUTTON_CSS = `
.maytes-checkout-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.57em;
  padding: 0.71em 1.29em;
  border: none;
  border-radius: 999px;
  background: ${foundation.brand.primary};
  color: ${foundation.text.primaryInverse};
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: var(--maytes-button-font-size, 14px);
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  user-select: none;
  transition: background-color 120ms ease, opacity 120ms ease;
}
.maytes-checkout-button:hover { background: ${foundation.palette.burgundy[700]}; }
.maytes-checkout-button:focus-visible {
  outline: 2px solid ${FOCUS_RING};
  outline-offset: 2px;
}
.maytes-checkout-button[aria-disabled='true'] {
  cursor: progress;
  opacity: 0.7;
}
.maytes-checkout-button--block {
  display: flex;
  width: 100%;
}
.maytes-checkout-button__logo { height: 1em; width: auto; flex: none; }
.maytes-checkout-button__spinner {
  height: 1em;
  width: 1em;
  border-radius: 50%;
  border: 0.14em solid currentColor;
  border-right-color: transparent;
  animation: maytes-checkout-button-spin 0.7s linear infinite;
}
@keyframes maytes-checkout-button-spin {
  to { transform: rotate(360deg); }
}
.maytes-checkout-overlay {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  max-width: 100vw;
  max-height: 100vh;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  z-index: 2147483646;
  font: 500 15px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
.maytes-checkout-overlay[open] {
  display: flex;
  align-items: center;
  justify-content: center;
}
.maytes-checkout-overlay::backdrop {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
.maytes-checkout-overlay__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}
.maytes-checkout-overlay__spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: ${foundation.brand.secondary};
  border-radius: 50%;
  animation: maytes-checkout-button-spin 0.8s linear infinite;
}
.maytes-checkout-overlay__text {
  color: ${foundation.text.primaryInverse};
  font-size: 1.125rem;
  font-weight: 500;
  margin: 0;
}
.maytes-checkout-overlay__link {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.875rem;
  text-decoration: underline;
  text-underline-offset: 4px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: color 0.15s;
}
.maytes-checkout-overlay__link:hover { color: ${foundation.text.primaryInverse}; }
@media (prefers-reduced-motion: reduce) {
  .maytes-checkout-overlay__spinner,
  .maytes-checkout-button__spinner { animation: none; }
}
`;

export const POPUP_LOADING_CSS = `
:root { color-scheme: light; }
html, body { margin: 0; height: 100%; }
body.maytes-popup-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: ${foundation.brand.primary};
  color: ${foundation.text.primaryInverse};
  font: 500 16px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
.maytes-popup-loading__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem;
  text-align: center;
}
.maytes-popup-loading__logo { height: 2.75rem; width: auto; }
.maytes-popup-loading__spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 4px solid rgba(255, 255, 255, 0.25);
  border-top-color: ${foundation.brand.secondary};
  border-radius: 50%;
  animation: maytes-checkout-button-spin 0.8s linear infinite;
}
@keyframes maytes-checkout-button-spin {
  to { transform: rotate(360deg); }
}
.maytes-popup-loading__text { margin: 0; font-size: 1.05rem; font-weight: 500; }
.maytes-popup-loading__slow {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.75);
  max-width: 22rem;
}
.maytes-popup-loading__slow[hidden] { display: none; }
@media (prefers-reduced-motion: reduce) {
  .maytes-popup-loading__spinner { animation: none; }
}
`;

function getRefCount(): number {
  const w = window as RefCountWindow;
  return w[REFCOUNT_KEY] ?? 0;
}

function setRefCount(value: number): void {
  const w = window as RefCountWindow;
  w[REFCOUNT_KEY] = value;
}

export function ensureStylesInjected(cspNonce: string | undefined): void {
  const next = getRefCount() + 1;
  setRefCount(next);
  if (document.head.querySelector(STYLE_SELECTOR) !== null) return;
  const el = document.createElement('style');
  el.setAttribute(STYLE_ATTR, SDK_VERSION);
  if (cspNonce !== undefined && cspNonce !== '') el.setAttribute('nonce', cspNonce);
  el.textContent = BUTTON_CSS;
  document.head.appendChild(el);
}

export function releaseStyles(): void {
  const next = Math.max(0, getRefCount() - 1);
  setRefCount(next);
  if (next > 0) return;
  const el = document.head.querySelector(STYLE_SELECTOR);
  if (el !== null) el.remove();
}

export function resetStylesForTests(): void {
  setRefCount(0);
  document.head.querySelectorAll(`style[${STYLE_ATTR}]`).forEach((el) => el.remove());
}
