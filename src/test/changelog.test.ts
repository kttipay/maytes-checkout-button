import { describe, expect, it } from 'vitest';
import { extractSection, findSectionBounds, injectSriBlock } from '../../scripts/lib/changelog.mjs';

const CHANGELOG = [
  '# Changelog',
  '',
  '## 0.3.0 — 2026-06-04',
  '',
  'Latest release notes.',
  '',
  '<!-- @hash-sri-start -->',
  'checkout-button.js   sha384-AAA',
  '<!-- @hash-sri-end -->',
  '',
  '## 0.2.0 — 2026-06-03 *(unreleased)*',
  '',
  'Superseded.',
  '',
  '## 0.2.0 — 2026-06-03',
  '',
  'First 0.2 entry.',
  '',
  '## 0.1.0 — 2026-05-14',
  '',
  'Older release.',
  '',
].join('\n');

describe('findSectionBounds', () => {
  it('returns null when the version is absent', () => {
    expect(findSectionBounds(CHANGELOG, '9.9.9')).toBeNull();
  });

  it('matches the first header for a duplicated version', () => {
    const bounds = findSectionBounds(CHANGELOG, '0.2.0');
    expect(bounds).not.toBeNull();
    if (bounds === null) return;
    const section = CHANGELOG.slice(bounds.start, bounds.end);
    expect(section).toContain('*(unreleased)*');
    expect(section).not.toContain('First 0.2 entry.');
  });
});

describe('extractSection', () => {
  it('returns the full section including its SRI block', () => {
    const section = extractSection(CHANGELOG, '0.3.0');
    expect(section).not.toBeNull();
    expect(section?.startsWith('## 0.3.0 — 2026-06-04')).toBe(true);
    expect(section).toContain('<!-- @hash-sri-start -->');
    expect(section).toContain('checkout-button.js   sha384-AAA');
    expect(section).toContain('<!-- @hash-sri-end -->');
    expect(section).not.toContain('## 0.2.0');
  });

  it('captures the trailing section through end of file', () => {
    const section = extractSection(CHANGELOG, '0.1.0');
    expect(section?.startsWith('## 0.1.0 — 2026-05-14')).toBe(true);
    expect(section).toContain('Older release.');
  });

  it('returns null for an unknown version', () => {
    expect(extractSection(CHANGELOG, '1.2.3')).toBeNull();
  });

  it('does not match a partial version prefix', () => {
    expect(extractSection(CHANGELOG, '0.3')).toBeNull();
  });
});

describe('injectSriBlock', () => {
  const SRI = '<!-- @hash-sri-start -->\nsha384-abc\n<!-- @hash-sri-end -->';

  // The bug this guards: the injection used to be gated on `private: true`.
  // Going live flips that to false, which turned every ordinary `npm run build`
  // into a changelog writer — inventing a `## 0.0.1` section, with CDN links,
  // for a version that is never published under that number.
  it('returns null when the version has no section — not a release build', () => {
    const changelog = '# Changelog\n\nThis project follows Keep a Changelog.\n';
    expect(injectSriBlock(changelog, '0.0.1', SRI)).toBeNull();
  });

  it('never invents a section, even when other versions are present', () => {
    const changelog = '# Changelog\n\n## 0.2.0\n\n- shipped\n';
    expect(injectSriBlock(changelog, '0.3.0', SRI)).toBeNull();
  });

  it('injects into the section changesets created', () => {
    const changelog = '# Changelog\n\n## 0.1.0\n\n### Minor Changes\n\n- first release\n';
    const updated = injectSriBlock(changelog, '0.1.0', SRI);
    expect(updated).toContain('sha384-abc');
    expect(updated).toContain('- first release');
  });

  it('replaces a previous block instead of stacking, so re-runs are idempotent', () => {
    const changelog = '# Changelog\n\n## 0.1.0\n\n- first release\n';
    const once = injectSriBlock(changelog, '0.1.0', SRI);
    const twice = injectSriBlock(once as string, '0.1.0', '<!-- @hash-sri-start -->\nsha384-xyz\n<!-- @hash-sri-end -->');
    expect(twice?.match(/@hash-sri-start/g)).toHaveLength(1);
    expect(twice).toContain('sha384-xyz');
    expect(twice).not.toContain('sha384-abc');
  });

  it("leaves other versions' sections untouched", () => {
    const changelog = '# Changelog\n\n## 0.2.0\n\n- newer\n\n## 0.1.0\n\n- older\n';
    const updated = injectSriBlock(changelog, '0.2.0', SRI) as string;
    const olderSection = updated.slice(updated.indexOf('## 0.1.0'));
    expect(olderSection).not.toContain('sha384-abc');
  });
});
