const CDN_HOST = 'js.maytes.co';
export const SEMVER_PIN_WILDCARD = '/v*.*.*/checkout-button.*';
export const HASH_PIN_WILDCARD = '/checkout-button.*.*';
export const EVERGREEN_WILDCARD = '/v*/checkout-button.*';

export const CACHE_RULES = [
  {
    id: 'checkout-button-immutable-pins',
    expression:
      `(http.host eq "${CDN_HOST}") and ((http.request.uri.path wildcard "${SEMVER_PIN_WILDCARD}") or (http.request.uri.path wildcard "${HASH_PIN_WILDCARD}"))`,
    edgeTtl: 31536000,
    browserTtl: 31536000,
  },
  {
    id: 'checkout-button-evergreen-major',
    expression:
      `(http.host eq "${CDN_HOST}") and (http.request.uri.path wildcard "${EVERGREEN_WILDCARD}") and (not (http.request.uri.path wildcard "${SEMVER_PIN_WILDCARD}"))`,
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
