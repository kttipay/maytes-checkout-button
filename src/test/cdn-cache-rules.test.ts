import { describe, expect, it } from 'vitest';
import { CACHE_RULES, rulesetNeedsUpdate } from '../../scripts/lib/cdn-cache-rules.mjs';

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

  it('reports an update needed when a TTL or the immutable flag changed', () => {
    const staleEdgeTtl = [{ ...CACHE_RULES[0], edgeTtl: 60 }, CACHE_RULES[1]];
    expect(rulesetNeedsUpdate(staleEdgeTtl)).toBe(true);

    const staleBrowserTtl = [CACHE_RULES[0], { ...CACHE_RULES[1], browserTtl: 60 }];
    expect(rulesetNeedsUpdate(staleBrowserTtl)).toBe(true);

    const staleImmutable = [CACHE_RULES[0], { ...CACHE_RULES[1], immutable: true }];
    expect(rulesetNeedsUpdate(staleImmutable)).toBe(true);
  });
});
