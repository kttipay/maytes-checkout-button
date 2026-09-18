const CDN_HOST = 'js.maytes.co';
export const SEMVER_PIN_WILDCARD = '/v*.*.*/checkout-button.*';
export const HASH_PIN_WILDCARD = '/checkout-button.*.*';
export const EVERGREEN_WILDCARD = '/v*/checkout-button.*';

export const UNHASHED_BUNDLE_PATHS = [
  '/checkout-button.js',
  '/checkout-button.mjs',
  '/checkout-button.cjs',
  '/checkout-button.js.map',
  '/checkout-button.mjs.map',
  '/checkout-button.cjs.map',
];

function scopedToHost(expression) {
  return `(http.host eq "${CDN_HOST}") and (${expression})`;
}

const notUnhashedBundle = UNHASHED_BUNDLE_PATHS.map(
  (path) => `not (http.request.uri.path eq "${path}")`,
).join(' and ');

export const CACHE_RULES = [
  {
    id: 'checkout-button-immutable-pins',
    expression: scopedToHost(
      `(http.request.uri.path wildcard "${SEMVER_PIN_WILDCARD}") or ((http.request.uri.path wildcard "${HASH_PIN_WILDCARD}") and ${notUnhashedBundle})`,
    ),
    edgeTtl: 31536000,
    browserTtl: 31536000,
  },
  {
    id: 'checkout-button-evergreen-major',
    expression: scopedToHost(
      `(http.request.uri.path wildcard "${EVERGREEN_WILDCARD}") and (not (http.request.uri.path wildcard "${SEMVER_PIN_WILDCARD}"))`,
    ),
    edgeTtl: 300,
    browserTtl: 300,
  },
];

export function rulesetNeedsUpdate(currentRules, desiredRules = CACHE_RULES) {
  return desiredRules.some((desired) => {
    const current = currentRules.find((rule) => rule.id === desired.id);
    if (current === undefined) return true;
    return (
      current.expression !== desired.expression ||
      current.edgeTtl !== desired.edgeTtl ||
      current.browserTtl !== desired.browserTtl
    );
  });
}
