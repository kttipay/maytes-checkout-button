import { MaytesError, MaytesErrorCode } from './errors.js';
import type { MaytesEnvironment } from './types.js';

export type InternalEnvironment = MaytesEnvironment | 'staging';

const ENVIRONMENT_BASE_URLS: Record<InternalEnvironment, string> = {
  staging: 'https://staging-checkout.maytes.co',
  sandbox: 'https://sandbox-checkout.maytes.co',
  production: 'https://checkout.maytes.co',
};

export function isValidEnvironment(value: unknown): value is InternalEnvironment {
  return value === 'sandbox' || value === 'production' || value === 'staging';
}

export function resolveBaseUrl(environment: InternalEnvironment, override: string | undefined): string {
  if (override !== undefined) return override;
  const url = ENVIRONMENT_BASE_URLS[environment];
  if (url === undefined) {
    throw new MaytesError(MaytesErrorCode.Config, `Unknown environment: ${String(environment)}`);
  }
  return url;
}
