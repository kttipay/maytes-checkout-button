import { buildMaytesLogo } from './branding.js';
import { foundation } from './foundation/brand.generated.js';
import { MaytesError, MaytesErrorCode } from './errors.js';
import { isSecurityError, navigateTopLevel, viewportWidth } from './framing.js';
import { hideOverlay, showOverlay } from './overlay.js';
import { buildCheckoutUrl, isHttpUrl } from './redirect.js';
import { ensureStylesInjected, POPUP_LOADING_CSS, releaseStyles } from './styles.js';
import type { InstanceState } from './state.js';
import type {
  CheckoutFailedReason,
  CheckoutRedirectedDetail,
  RedirectTarget,
  RenderButtonCleanup,
  RenderButtonMode,
  RenderButtonOptions,
} from './types.js';

const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 800;
const POPUP_POLL_INTERVAL_MS = 500;
const MOBILE_MAX_WIDTH = 600;
const SLOW_NETWORK_DELAY_MS = 8000;

function buildLogo(): SVGSVGElement {
  const svg = buildMaytesLogo('1em', 'currentColor');
  svg.setAttribute('class', 'maytes-checkout-button__logo');
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}

function buildSpinner(): HTMLSpanElement {
  const spinner = document.createElement('span');
  spinner.className = 'maytes-checkout-button__spinner';
  spinner.setAttribute('aria-hidden', 'true');
  return spinner;
}

function isValidCheckoutResult(value: unknown): value is { checkoutId: string; checkoutUrl?: string } {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as { checkoutId?: unknown; checkoutUrl?: unknown };
  if (typeof obj.checkoutId !== 'string' || obj.checkoutId.trim().length === 0) return false;
  if (obj.checkoutUrl !== undefined) {
    if (typeof obj.checkoutUrl !== 'string' || obj.checkoutUrl.trim().length === 0) return false;
    if (!isHttpUrl(obj.checkoutUrl)) return false;
  }
  return true;
}

function refocusPopup(popup: Window): void {
  try { popup.focus(); } catch (err) {
    if (!isSecurityError(err)) throw err;
  }
}

export function closePopupWindow(popup: Window | null): void {
  if (popup === null) return;
  try {
    if (!popup.closed) popup.close();
  } catch (err) {
    if (!isSecurityError(err)) throw err;
  }
}

function popupFeatures(): string {
  const screenWidth = window.screen?.width ?? POPUP_WIDTH;
  const screenHeight = window.screen?.height ?? POPUP_HEIGHT;
  const left = Math.max(0, Math.round((screenWidth - POPUP_WIDTH) / 2));
  const top = Math.max(0, Math.round((screenHeight - POPUP_HEIGHT) / 2));
  return `popup=yes,width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},resizable=yes,scrollbars=yes`;
}

export function stopPopupPoll(state: InstanceState): void {
  if (state.popupPollHandle !== null) {
    clearInterval(state.popupPollHandle);
    state.popupPollHandle = null;
  }
}

function startPopupPoll(state: InstanceState, onClose: () => void): void {
  stopPopupPoll(state);
  state.popupPollHandle = setInterval(() => {
    const popup = state.popupWindow;
    if (popup === null || popup.closed) {
      stopPopupPoll(state);
      state.popupWindow = null;
      onClose();
    }
  }, POPUP_POLL_INTERVAL_MS);
}

function isMobileViewport(): boolean {
  return viewportWidth() <= MOBILE_MAX_WIDTH;
}

function openBlankPopup(state: InstanceState): Window | null {
  return window.open('about:blank', state.popupName, popupFeatures());
}

function navigatePopup(popup: Window, url: string): void {
  popup.location.replace(url);
}

function removePopupChildren(doc: Document): void {
  while (doc.body.firstChild !== null) doc.body.removeChild(doc.body.firstChild);
}

function paintPopupLoadingScreen(popup: Window, cspNonce: string | undefined): void {
  const doc = popup.document as Document | null;
  if (doc === null || doc.head === null || doc.body === null) return;
  doc.title = 'Maytes checkout';
  doc.documentElement.lang = 'en';
  const style = doc.createElement('style');
  if (cspNonce !== undefined && cspNonce !== '') style.setAttribute('nonce', cspNonce);
  style.textContent = POPUP_LOADING_CSS;
  doc.head.appendChild(style);

  doc.body.classList.add('maytes-popup-loading');
  removePopupChildren(doc);

  const content = doc.createElement('main');
  content.className = 'maytes-popup-loading__content';
  content.setAttribute('role', 'status');
  content.setAttribute('aria-live', 'polite');

  const logo = buildMaytesLogo('2.75rem', foundation.text.primaryInverse);
  logo.setAttribute('class', 'maytes-popup-loading__logo');
  logo.setAttribute('aria-hidden', 'true');
  content.appendChild(logo);

  const spinner = doc.createElement('div');
  spinner.className = 'maytes-popup-loading__spinner';
  spinner.setAttribute('aria-hidden', 'true');
  content.appendChild(spinner);

  const text = doc.createElement('p');
  text.className = 'maytes-popup-loading__text';
  text.textContent = 'Completing checkout with Maytes…';
  content.appendChild(text);

  const slow = doc.createElement('p');
  slow.className = 'maytes-popup-loading__slow';
  slow.hidden = true;
  slow.textContent = 'Still connecting. This can take a moment on slow networks.';
  content.appendChild(slow);

  doc.body.appendChild(content);
  setTimeout(() => { slow.hidden = false; }, SLOW_NETWORK_DELAY_MS);
}

export function renderButton(
  state: InstanceState,
  container: HTMLElement,
  options: RenderButtonOptions = {},
): RenderButtonCleanup {
  if (state.destroyed) {
    throw new MaytesError(
      MaytesErrorCode.Config,
      'renderButton() called on a destroyed Maytes instance',
    );
  }
  if (!(container instanceof HTMLElement)) {
    throw new MaytesError(MaytesErrorCode.Config, 'renderButton(container) requires an HTMLElement');
  }

  ensureStylesInjected(state.config.cspNonce);

  const label = options.label ?? 'Split with';
  const block = options.block === true;
  const mode: RenderButtonMode = options.mode ?? 'popup';
  if (mode !== 'redirect' && mode !== 'popup') {
    throw new MaytesError(
      MaytesErrorCode.Config,
      "renderButton({ mode }) must be 'redirect' or 'popup'",
    );
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = block
    ? 'maytes-checkout-button maytes-checkout-button--block'
    : 'maytes-checkout-button';
  button.setAttribute('aria-label', `${label} Maytes`);

  const labelNode = document.createTextNode(`${label} `);
  let icon: SVGSVGElement | HTMLSpanElement = buildLogo();
  button.appendChild(labelNode);
  button.appendChild(icon);

  const setBusy = (busy: boolean) => {
    state.busy = busy;
    if (busy) {
      button.setAttribute('aria-disabled', 'true');
      button.setAttribute('aria-busy', 'true');
      const spinner = buildSpinner();
      icon.replaceWith(spinner);
      icon = spinner;
    } else {
      button.removeAttribute('aria-disabled');
      button.removeAttribute('aria-busy');
      const nextLogo = buildLogo();
      icon.replaceWith(nextLogo);
      icon = nextLogo;
    }
  };

  const teardownActiveCheckout = () => {
    hideOverlay(state);
    setBusy(false);
  };

  const onPopupClosed = () => {
    teardownActiveCheckout();
    document.dispatchEvent(new CustomEvent('maytes:checkout-closed'));
  };

  const dispatchFailed = (reason: CheckoutFailedReason, cause?: unknown): void => {
    document.dispatchEvent(new CustomEvent('maytes:checkout-failed', {
      detail: cause === undefined ? { reason } : { reason, cause },
    }));
  };

  const dispatchRedirected = (url: string, target: RedirectTarget): void => {
    const detail: CheckoutRedirectedDetail = { url, target };
    document.dispatchEvent(new CustomEvent('maytes:checkout-redirected', { detail }));
  };

  const navigateAway = (url: string): void => {
    const outcome = navigateTopLevel(url, false);
    teardownActiveCheckout();
    if (outcome.target === null) {
      console.error('[maytes/checkout-button] could not leave the embedding frame:', outcome.cause);
      dispatchFailed('navigation-blocked', outcome.cause);
      return;
    }
    dispatchRedirected(url, outcome.target);
  };

  const closeOrphanPopup = (popup: Window | null): void => {
    closePopupWindow(popup);
    stopPopupPoll(state);
    if (state.popupWindow === popup) state.popupWindow = null;
    teardownActiveCheckout();
  };

  const handleClick = async (): Promise<void> => {
    if (state.busy || state.destroyed) return;
    setBusy(true);
    const shouldUsePopup = mode === 'popup' && !isMobileViewport();
    const popup = shouldUsePopup ? openBlankPopup(state) : null;
    if (popup !== null) {
      state.popupWindow = popup;
      state.popupNavigated = false;
      refocusPopup(popup);
      paintPopupLoadingScreen(popup, state.config.cspNonce);
      showOverlay(state);
      document.dispatchEvent(new CustomEvent('maytes:checkout-opened'));
      startPopupPoll(state, onPopupClosed);
    }
    try {
      const result = await state.config.createCheckout();
      if (state.destroyed || (popup !== null && popup.closed)) {
        closePopupWindow(popup);
        return;
      }
      if (!isValidCheckoutResult(result)) {
        closeOrphanPopup(popup);
        const shapeError = new MaytesError(
          MaytesErrorCode.Config,
          'createCheckout must resolve to { checkoutId: string, checkoutUrl?: http(s) URL }',
        );
        console.error(shapeError);
        dispatchFailed('invalid-shape', shapeError);
        return;
      }
      const url = result.checkoutUrl ?? buildCheckoutUrl(
        state.config.environment,
        state.config.baseUrl,
        result.checkoutId,
      );
      if (popup !== null) {
        state.popupNavigated = true;
        navigatePopup(popup, url);
      } else {
        if (shouldUsePopup) {
          console.warn('[maytes/checkout-button] popup was blocked; redirecting instead');
        }
        navigateAway(url);
      }
    } catch (err) {
      if (popup !== null && popup.closed) return;
      closeOrphanPopup(popup);
      console.error('[maytes/checkout-button] createCheckout failed:', err);
      dispatchFailed('create-checkout-rejected', err);
    }
  };

  button.addEventListener('click', handleClick);
  container.appendChild(button);

  let cleaned = false;
  const teardown = (): void => {
    if (cleaned) return;
    cleaned = true;
    button.removeEventListener('click', handleClick);
    button.remove();
    state.teardowns.delete(teardown);
    releaseStyles();
  };
  state.teardowns.add(teardown);

  return teardown;
}
