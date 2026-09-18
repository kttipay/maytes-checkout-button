import type { MaytesErrorCodeValue } from './errors.js';

export type MaytesEnvironment = 'sandbox' | 'production';

export interface CreateCheckoutResult {
  checkoutId: string;
  checkoutUrl?: string;
}

export type CreateCheckoutFn = () => Promise<CreateCheckoutResult>;

export interface MaytesOptions {
  createCheckout: CreateCheckoutFn;
  environment: MaytesEnvironment;
}

export interface MaytesInternalOptions {
  baseUrl?: string;
  cspNonce?: string;
}

export type RenderButtonMode = 'redirect' | 'popup';

export interface RenderButtonOptions {
  label?: string;
  block?: boolean;
  mode?: RenderButtonMode;
}

export type RenderButtonCleanup = () => void;

export type RedirectTarget = 'self' | 'top' | 'tab';

export interface CheckoutUrlOptions {
  checkoutId: string;
}

export interface RedirectOptions extends CheckoutUrlOptions {
  replace?: boolean;
}

export interface MaytesSDK {
  renderButton(container: HTMLElement, options?: RenderButtonOptions): RenderButtonCleanup;
  redirectToCheckout(options: RedirectOptions): void;
  checkoutUrl(options: CheckoutUrlOptions): string;
  destroy(): void;
}

export type MaytesFactory = (
  options: MaytesOptions,
  internal?: MaytesInternalOptions,
) => MaytesSDK;

export type { MaytesErrorCodeValue };

declare global {
  interface Window {
    Maytes: MaytesFactory;
  }
}
