import { Maytes } from './maytes.js';

if (typeof window !== 'undefined') {
  (window as unknown as { Maytes: typeof Maytes }).Maytes = Maytes;
}

export { Maytes };
export { MaytesError, MaytesErrorCode } from './errors.js';
export type { MaytesErrorCodeValue } from './errors.js';
export type {
  CheckoutUrlOptions,
  CreateCheckoutFn,
  MaytesEnvironment,
  MaytesFactory,
  MaytesInternalOptions,
  MaytesOptions,
  MaytesSDK,
  RedirectOptions,
  RenderButtonCleanup,
  RenderButtonMode,
  RenderButtonOptions,
} from './types.js';
export { SDK_VERSION } from './version.js';
