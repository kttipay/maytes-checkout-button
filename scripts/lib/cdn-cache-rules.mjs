export const CACHE_RULES = [
  {
    id: 'checkout-button-immutable-pins',
    expression:
      '(http.request.uri.path matches "^/v[0-9]+\\.[0-9]+\\.[0-9]+/") or (http.request.uri.path matches "^/checkout-button\\.[0-9a-f]{8}\\.")',
    edgeTtl: 31536000,
    browserTtl: 31536000,
    immutable: true,
  },
  {
    id: 'checkout-button-evergreen-major',
    expression: '(http.request.uri.path matches "^/v[0-9]+/")',
    edgeTtl: 300,
    browserTtl: 300,
    immutable: false,
  },
];

export function rulesetNeedsUpdate(currentRules, desiredRules = CACHE_RULES) {
  return desiredRules.some((desired) => {
    const current = currentRules.find((rule) => rule.id === desired.id);
    if (current === undefined) return true;
    return (
      current.expression !== desired.expression ||
      current.edgeTtl !== desired.edgeTtl ||
      current.browserTtl !== desired.browserTtl ||
      current.immutable !== desired.immutable
    );
  });
}
