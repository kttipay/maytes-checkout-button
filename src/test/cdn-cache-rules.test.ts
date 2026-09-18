import { describe, expect, it } from 'vitest';
import {
  CACHE_RULES,
  EVERGREEN_WILDCARD,
  HASH_PIN_WILDCARD,
  SEMVER_PIN_WILDCARD,
  UNHASHED_BUNDLE_PATHS,
  rulesetNeedsUpdate,
} from '../../scripts/lib/cdn-cache-rules.mjs';

function wildcardMatches(pattern: string, path: string): boolean {
  const escaped = pattern
    .split('*')
    .map((segment) => segment.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}$`).test(path);
}

function matchesImmutablePinRule(path: string): boolean {
  return (
    wildcardMatches(SEMVER_PIN_WILDCARD, path) ||
    (wildcardMatches(HASH_PIN_WILDCARD, path) && !UNHASHED_BUNDLE_PATHS.includes(path))
  );
}

describe('CACHE_RULES', () => {
  it('defines exactly 2 fixed rules', () => {
    expect(CACHE_RULES).toHaveLength(2);
  });

  it('scopes every rule to the js.maytes.co host', () => {
    for (const rule of CACHE_RULES) {
      expect(rule.expression).toContain('http.host eq "js.maytes.co"');
    }
  });
});

describe('wildcard pattern disambiguation', () => {
  it('matches a pinned SemVer path against the SemVer pattern', () => {
    expect(wildcardMatches(SEMVER_PIN_WILDCARD, '/v1.0.1/checkout-button.js')).toBe(true);
    expect(wildcardMatches(SEMVER_PIN_WILDCARD, '/v1.0.1/checkout-button.mjs')).toBe(true);
  });

  it('does not match the bare-major evergreen path against the SemVer pattern', () => {
    expect(wildcardMatches(SEMVER_PIN_WILDCARD, '/v1/checkout-button.js')).toBe(false);
  });

  it('matches a content-hash path against the hash pattern, not the bare unhashed file', () => {
    expect(wildcardMatches(HASH_PIN_WILDCARD, '/checkout-button.8c71493e.js')).toBe(true);
    expect(wildcardMatches(HASH_PIN_WILDCARD, '/checkout-button.8c71493e.js.map')).toBe(true);
    expect(wildcardMatches(HASH_PIN_WILDCARD, '/checkout-button.js')).toBe(false);
  });

  it('matches the bare-major evergreen path against the evergreen pattern', () => {
    expect(wildcardMatches(EVERGREEN_WILDCARD, '/v1/checkout-button.js')).toBe(true);
  });

  it('also matches a pinned SemVer path against the evergreen pattern alone, which is why rule 2 excludes rule 1', () => {
    expect(wildcardMatches(EVERGREEN_WILDCARD, '/v1.0.1/checkout-button.js')).toBe(true);
  });
});

describe('immutable-pins rule composition (wildcard + unhashed-bundle exclusion)', () => {
  it('matches genuinely content-hashed bundle and map files', () => {
    expect(matchesImmutablePinRule('/checkout-button.8c71493e.js')).toBe(true);
    expect(matchesImmutablePinRule('/checkout-button.8c71493e.js.map')).toBe(true);
  });

  it('matches pinned SemVer paths', () => {
    expect(matchesImmutablePinRule('/v1.0.1/checkout-button.js')).toBe(true);
  });

  it('does not match the bare unhashed bundle files', () => {
    expect(matchesImmutablePinRule('/checkout-button.js')).toBe(false);
    expect(matchesImmutablePinRule('/checkout-button.mjs')).toBe(false);
    expect(matchesImmutablePinRule('/checkout-button.cjs')).toBe(false);
  });

  it('does not match the bare unhashed bundle files own source maps', () => {
    expect(matchesImmutablePinRule('/checkout-button.js.map')).toBe(false);
    expect(matchesImmutablePinRule('/checkout-button.mjs.map')).toBe(false);
    expect(matchesImmutablePinRule('/checkout-button.cjs.map')).toBe(false);
  });

  it('does not match the type declaration files tsup also writes to dist root', () => {
    expect(matchesImmutablePinRule('/checkout-button.d.ts')).toBe(false);
    expect(matchesImmutablePinRule('/checkout-button.d.cts')).toBe(false);
  });

  it('every UNHASHED_BUNDLE_PATHS entry is actually excluded from the composed CACHE_RULES[0] expression', () => {
    for (const path of UNHASHED_BUNDLE_PATHS) {
      expect(CACHE_RULES[0].expression).toContain(`not (http.request.uri.path eq "${path}")`);
    }
  });

  it('CACHE_RULES[1] retains the exclusion that stops it from overriding immutable pins', () => {
    expect(CACHE_RULES[1].expression).toContain(`not (http.request.uri.path wildcard "${SEMVER_PIN_WILDCARD}")`);
  });
});

describe('rulesetNeedsUpdate', () => {
  it('reports no update needed when current rules already match', () => {
    expect(rulesetNeedsUpdate(CACHE_RULES)).toBe(false);
  });

  it('reports an update needed when a rule is missing', () => {
    expect(rulesetNeedsUpdate([CACHE_RULES[0]])).toBe(true);
  });

  it('reports an update needed when an expression changed', () => {
    const stale = [{ ...CACHE_RULES[0], expression: 'old expression' }, CACHE_RULES[1]];
    expect(rulesetNeedsUpdate(stale)).toBe(true);
  });

  it('reports an update needed when a TTL changed', () => {
    const staleEdgeTtl = [{ ...CACHE_RULES[0], edgeTtl: 60 }, CACHE_RULES[1]];
    expect(rulesetNeedsUpdate(staleEdgeTtl)).toBe(true);

    const staleBrowserTtl = [CACHE_RULES[0], { ...CACHE_RULES[1], browserTtl: 60 }];
    expect(rulesetNeedsUpdate(staleBrowserTtl)).toBe(true);
  });
});
