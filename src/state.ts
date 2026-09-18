import type { MaytesOptions, MaytesInternalOptions } from './types.js';

export interface InstanceState {
  config: MaytesOptions & MaytesInternalOptions;
  busy: boolean;
  overlayEl: HTMLDialogElement | null;
  overlayDetach: (() => void) | null;
  popupWindow: Window | null;
  popupNavigated: boolean;
  popupName: string;
  popupPollHandle: ReturnType<typeof setInterval> | null;
  destroyed: boolean;
  teardowns: Set<() => void>;
}

function popupNameSuffix(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function generatePopupName(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return `maytes-checkout-${crypto.randomUUID()}`;
    } catch {
      return `maytes-checkout-${popupNameSuffix()}`;
    }
  }
  return `maytes-checkout-${popupNameSuffix()}`;
}

export function createInstanceState(
  options: MaytesOptions,
  internal: MaytesInternalOptions | undefined,
): InstanceState {
  const config: MaytesOptions & MaytesInternalOptions = {
    createCheckout: options.createCheckout,
    environment: options.environment,
  };
  if (internal?.baseUrl !== undefined) config.baseUrl = internal.baseUrl;
  if (internal?.cspNonce !== undefined) config.cspNonce = internal.cspNonce;
  return {
    config,
    busy: false,
    overlayEl: null,
    overlayDetach: null,
    popupWindow: null,
    popupNavigated: false,
    popupName: generatePopupName(),
    popupPollHandle: null,
    destroyed: false,
    teardowns: new Set(),
  };
}
