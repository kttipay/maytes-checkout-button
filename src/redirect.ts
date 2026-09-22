import { MaytesError, MaytesErrorCode } from './errors.js';
import { resolveBaseUrl, type InternalEnvironment } from './env.js';
import { navigateTopLevel } from './framing.js';
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
  /* v8 ignore next 6 -- unreachable under jsdom; window is always defined in this SDK's browser-only distribution */
  if (typeof window === 'undefined') {
    throw new MaytesError(
      MaytesErrorCode.Config,
      'redirectToCheckout requires a browser context (window is undefined)',
    );
  }
  const outcome = navigateTopLevel(url, replace);
  if (outcome.target === null) {
    throw new MaytesError(
      MaytesErrorCode.Config,
      'redirectToCheckout could not leave the embedding iframe; call it from a user gesture or from the top-level page',
    );
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
