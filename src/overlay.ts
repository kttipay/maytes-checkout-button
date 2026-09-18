import { buildMaytesLogo, MAYTES_WALLET } from './branding.js';
import { isSecurityError, sameOriginTop } from './framing.js';
import type { InstanceState } from './state.js';

const TITLE_ID = 'maytes-overlay-title';
const STYLE_MARKER = 'data-maytes-checkout-button-overlay-styles';
const NATIVE_BACKDROP_FALLBACK = 'rgba(0, 0, 0, 0.6)';

function tryReadTopDocument(): Document | null {
  const top = sameOriginTop();
  if (top === null) return null;
  const topDoc = top.document;
  return topDoc.body !== null ? topDoc : null;
}

function resolveOverlayHost(): Document {
  return tryReadTopDocument() ?? document;
}

function ensureOverlayStylesInTopDocument(host: Document): void {
  if (host === document) return;
  if (host.querySelector(`style[${STYLE_MARKER}]`) !== null) return;
  const localStyle = document.head.querySelector('style[data-maytes-checkout-button]');
  if (localStyle === null) return;
  const copy = host.createElement('style');
  copy.setAttribute(STYLE_MARKER, '');
  const nonce = localStyle.getAttribute('nonce');
  if (nonce !== null) copy.setAttribute('nonce', nonce);
  copy.textContent = localStyle.textContent ?? '';
  host.head.appendChild(copy);
}

function buildOverlay(host: Document, state: InstanceState): HTMLDialogElement {
  const dialog = host.createElement('dialog');
  dialog.className = 'maytes-checkout-overlay';
  dialog.setAttribute('aria-labelledby', TITLE_ID);
  dialog.setAttribute('data-maytes-overlay', '');

  const content = host.createElement('div');
  content.className = 'maytes-checkout-overlay__content';

  const logoDiv = host.createElement('div');
  logoDiv.setAttribute('aria-hidden', 'true');
  logoDiv.appendChild(buildMaytesLogo('2.5rem', MAYTES_WALLET));
  content.appendChild(logoDiv);

  const spinner = host.createElement('div');
  spinner.className = 'maytes-checkout-overlay__spinner';
  spinner.setAttribute('role', 'status');
  spinner.setAttribute('aria-live', 'polite');
  spinner.setAttribute('aria-label', 'Checkout in progress');
  content.appendChild(spinner);

  const text = host.createElement('p');
  text.id = TITLE_ID;
  text.className = 'maytes-checkout-overlay__text';
  text.textContent = 'Completing checkout with Maytes…';
  content.appendChild(text);

  const link = host.createElement('button');
  link.className = 'maytes-checkout-overlay__link';
  link.type = 'button';
  link.textContent = 'Return to Maytes';
  link.addEventListener('click', () => {
    if (state.popupWindow !== null && !state.popupWindow.closed) {
      try { state.popupWindow.focus(); } catch (err) {
        if (!isSecurityError(err)) throw err;
      }
    }
  });
  content.appendChild(link);

  dialog.appendChild(content);

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (state.popupWindow !== null && !state.popupWindow.closed) state.popupWindow.close();
    hideOverlay(state);
  });

  return dialog;
}

function applyNativeBackdropFallback(dialog: HTMLDialogElement): void {
  dialog.style.background = NATIVE_BACKDROP_FALLBACK;
}

export function showOverlay(state: InstanceState): void {
  if (state.overlayEl !== null) return;
  const host = resolveOverlayHost();
  ensureOverlayStylesInTopDocument(host);
  const dialog = buildOverlay(host, state);
  state.overlayEl = dialog;
  host.body.appendChild(dialog);
  if (host !== document) detachOverlayWhenThisPageHides(state);
  if (typeof dialog.showModal === 'function') {
    try {
      dialog.showModal();
    } catch (err) {
      console.warn('[maytes/checkout-button] dialog.showModal failed; falling back to inline backdrop', err);
      dialog.setAttribute('open', '');
      applyNativeBackdropFallback(dialog);
    }
  } else {
    dialog.setAttribute('open', '');
    applyNativeBackdropFallback(dialog);
  }
}

function detachOverlayWhenThisPageHides(state: InstanceState): void {
  const onPageHide = () => hideOverlay(state);
  window.addEventListener('pagehide', onPageHide);
  state.overlayDetach = () => window.removeEventListener('pagehide', onPageHide);
}

export function hideOverlay(state: InstanceState): void {
  if (state.overlayEl === null) return;
  state.overlayDetach?.();
  state.overlayDetach = null;
  const dialog = state.overlayEl;
  const host = dialog.ownerDocument;
  if (typeof dialog.close === 'function' && dialog.open) dialog.close();
  dialog.remove();
  if (host !== document) {
    host.head.querySelector(`style[${STYLE_MARKER}]`)?.remove();
  }
  state.overlayEl = null;
}
