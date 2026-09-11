import { MaytesError, MaytesErrorCode } from './errors.js';
import { resolveBaseUrl, type InternalEnvironment } from './env.js';
import type { CheckoutUrlOptions, RedirectOptions } from './types.js';

export function isHttpUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === 'https:' || parsed.protocol === 'http:';
}

export function normalizeBaseUrl(rawBaseUrl: string): string {
  const candidate = rawBaseUrl.trim().replace(/\/+$/, '');
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new MaytesError(MaytesErrorCode.Config, `baseUrl is not a valid URL: ${candidate}`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new MaytesError(
      MaytesErrorCode.Config,
      `baseUrl must use http or https; got ${parsed.protocol}`,
    );
  }
  return candidate;
}

function requireCheckoutId(id: unknown): string {
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new MaytesError(MaytesErrorCode.Config, 'checkoutId is required (non-empty string)');
  }
  return id.trim();
}

export function buildCheckoutUrl(
  environment: InternalEnvironment,
  baseUrlOverride: string | undefined,
  checkoutId: string,
): string {
  const id = requireCheckoutId(checkoutId);
  const base = normalizeBaseUrl(resolveBaseUrl(environment, baseUrlOverride));
  return `${base}/?id=${encodeURIComponent(id)}`;
}

export function performRedirect(url: string, replace: boolean): void {
  if (typeof window === 'undefined') {
    throw new MaytesError(
      MaytesErrorCode.Config,
      'redirectToCheckout requires a browser context (window is undefined)',
    );
  }
  if (replace) {
    window.location.replace(url);
  } else {
    window.location.href = url;
  }
}

export function makeRedirect(
  environment: InternalEnvironment,
  baseUrlOverride: string | undefined,
) {
  return {
    checkoutUrl(opts: CheckoutUrlOptions): string {
      return buildCheckoutUrl(environment, baseUrlOverride, opts.checkoutId);
    },
    redirectToCheckout(opts: RedirectOptions): void {
      const url = buildCheckoutUrl(environment, baseUrlOverride, opts.checkoutId);
      performRedirect(url, opts.replace === true);
    },
  };
}
