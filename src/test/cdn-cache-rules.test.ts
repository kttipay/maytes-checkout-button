import { describe, expect, it } from 'vitest';
import {
  CACHE_RULES,
  EVERGREEN_WILDCARD,
  HASH_PIN_WILDCARD,
  SEMVER_PIN_WILDCARD,
  rulesetNeedsUpdate,
} from '../../scripts/lib/cdn-cache-rules.mjs';

function wildcardMatches(pattern: string, path: string): boolean {
  const escaped = pattern
    .split('*')
    .map((segment) => segment.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}$`).test(path);
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
