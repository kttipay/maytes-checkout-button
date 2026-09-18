export const CACHE_RULES = [
  {
    id: 'checkout-button-immutable-pins',
    expression:
      '(http.request.uri.path matches "^/v[0-9]+\\.[0-9]+\\.[0-9]+/") or (http.request.uri.path matches "^/checkout-button\\.[0-9a-f]{8}\\.")',
    cacheControl: 'public, max-age=31536000, immutable',
  },
  {
    id: 'checkout-button-evergreen-major',
    expression: '(http.request.uri.path matches "^/v[0-9]+/")',
    cacheControl: 'public, max-age=300',
  },
];

export function rulesetNeedsUpdate(currentRules, desiredRules = CACHE_RULES) {
  if (currentRules.length !== desiredRules.length) return true;
  return desiredRules.some((desired) => {
    const current = currentRules.find((rule) => rule.id === desired.id);
    if (current === undefined) return true;
    return current.expression !== desired.expression || current.cacheControl !== desired.cacheControl;
  });
}
