import { closePopupWindow, renderButton, stopPopupPoll } from './button.js';
import { isValidEnvironment } from './env.js';
import { MaytesError, MaytesErrorCode } from './errors.js';
import { hideOverlay } from './overlay.js';
import { makeRedirect, normalizeBaseUrl } from './redirect.js';
import { createInstanceState } from './state.js';
import type {
  MaytesFactory,
  MaytesInternalOptions,
  MaytesOptions,
  MaytesSDK,
} from './types.js';

function validateOptions(options: MaytesOptions): void {
  if (typeof options !== 'object' || options === null) {
    throw new MaytesError(MaytesErrorCode.Config, 'Maytes() requires an options object');
  }
  if (typeof options.createCheckout !== 'function') {
    throw new MaytesError(
      MaytesErrorCode.Config,
      'Maytes({ createCheckout }) must be an async function returning { checkoutId }',
    );
  }
  if (!isValidEnvironment(options.environment)) {
    throw new MaytesError(
      MaytesErrorCode.Config,
      "Maytes({ environment }) must be 'sandbox' or 'production'",
    );
  }
}

function validateInternalOptions(internal: MaytesInternalOptions | undefined): void {
  if (internal === undefined) return;
  if (internal.baseUrl !== undefined) normalizeBaseUrl(internal.baseUrl);
}

export const Maytes: MaytesFactory = (options, internal) => {
  validateOptions(options);
  validateInternalOptions(internal);

  const state = createInstanceState(options, internal);
  const { checkoutUrl, redirectToCheckout } = makeRedirect(
    state.config.environment,
    state.config.baseUrl,
  );

  const sdk: MaytesSDK = {
    renderButton(container, opts) {
      return renderButton(state, container, opts);
    },
    redirectToCheckout(opts) {
      redirectToCheckout(opts);
    },
    checkoutUrl(opts) {
      return checkoutUrl(opts);
    },
    destroy() {
      if (state.destroyed) return;
      state.destroyed = true;
      stopPopupPoll(state);
      hideOverlay(state);
      closePopupWindow(state.popupWindow);
      state.popupWindow = null;
      state.busy = false;
      for (const teardown of [...state.teardowns]) teardown();
      state.teardowns.clear();
    },
  };

  return sdk;
};
