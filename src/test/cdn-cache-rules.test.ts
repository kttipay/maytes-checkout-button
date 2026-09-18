import { describe, expect, it } from 'vitest';
import { CACHE_RULES, rulesetNeedsUpdate } from '../../scripts/lib/cdn-cache-rules.mjs';

describe('CACHE_RULES', () => {
  it('defines exactly 2 fixed rules', () => {
    expect(CACHE_RULES).toHaveLength(2);
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

  it('reports an update needed when cache-control changed', () => {
    const stale = [{ ...CACHE_RULES[0], cacheControl: 'public, max-age=60' }, CACHE_RULES[1]];
    expect(rulesetNeedsUpdate(stale)).toBe(true);
  });
});
