import { describe, expect, it } from 'vitest';
import { compareVersions, latestPerMajor } from '../../scripts/lib/semver-lite.mjs';

describe('compareVersions', () => {
  it('orders by major, then minor, then patch', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0);
    expect(compareVersions('1.1.0', '1.0.9')).toBeGreaterThan(0);
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
  });

  it('compares numerically, not lexicographically', () => {
    expect(compareVersions('1.9.0', '1.10.0')).toBeLessThan(0);
  });

  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.0.1', '1.0.1')).toBe(0);
  });
});

describe('latestPerMajor', () => {
  it('picks the highest version within each major', () => {
    const result = latestPerMajor(['1.0.0', '1.0.1', '1.2.0', '2.0.0', '2.1.0']);
    expect(result.get('1')).toBe('1.2.0');
    expect(result.get('2')).toBe('2.1.0');
    expect(result.size).toBe(2);
  });

  it('handles a single version', () => {
    expect(latestPerMajor(['0.2.3']).get('0')).toBe('0.2.3');
  });

  it('is order-independent', () => {
    const result = latestPerMajor(['1.2.0', '1.0.0', '1.0.1']);
    expect(result.get('1')).toBe('1.2.0');
  });
});
