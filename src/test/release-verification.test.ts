import { describe, expect, it } from 'vitest';
import { checkTagCoverage, verifyReleaseHash } from '../../scripts/lib/release-verification.mjs';

describe('verifyReleaseHash', () => {
  it('passes when the recomputed hash matches the CHANGELOG record', () => {
    const result = verifyReleaseHash({
      tag: 'v1.0.0',
      sourceName: 'checkout-button.js',
      recomputedSri: 'sha384-AAA',
      changelogSri: 'sha384-AAA',
      integritySri: 'sha384-DIFFERENT',
    });
    expect(result.ok).toBe(true);
  });

  it('falls back to the integrity.json value when no CHANGELOG record exists', () => {
    const result = verifyReleaseHash({
      tag: 'v1.0.0',
      sourceName: 'checkout-button.js',
      recomputedSri: 'sha384-AAA',
      changelogSri: undefined,
      integritySri: 'sha384-AAA',
    });
    expect(result.ok).toBe(true);
  });

  it('fails on a mismatch and reports both values', () => {
    const result = verifyReleaseHash({
      tag: 'v1.0.0',
      sourceName: 'checkout-button.js',
      recomputedSri: 'sha384-TAMPERED',
      changelogSri: 'sha384-AAA',
      integritySri: 'sha384-AAA',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('sha384-TAMPERED');
    expect(result.message).toContain('sha384-AAA');
  });
});

describe('checkTagCoverage', () => {
  it('passes when tags were found', () => {
    expect(checkTagCoverage({ tagCount: 2, changelogVersionCount: 2 }).ok).toBe(true);
  });

  it('passes for a brand-new repo with no prior releases yet', () => {
    expect(checkTagCoverage({ tagCount: 0, changelogVersionCount: 1 }).ok).toBe(true);
  });

  it('fails at the threshold when CHANGELOG has 2+ versions but no tags', () => {
    const result = checkTagCoverage({ tagCount: 0, changelogVersionCount: 2 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('fetch-tags');
  });

  it('fails when CHANGELOG has history but no tags were fetched', () => {
    const result = checkTagCoverage({ tagCount: 0, changelogVersionCount: 3 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('fetch-tags');
  });
});
