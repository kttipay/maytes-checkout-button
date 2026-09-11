import { describe, expect, it } from 'vitest';
import { buildCdnConfig, cdnUrl, hashedUrl, semverPath, semverUrl } from '../../scripts/lib/cdn-config.mjs';

const INTEGRITY = {
  version: '0.2.3',
  files: {
    'checkout-button.js': {
      hashedName: 'checkout-button.abc12345.js',
    },
    'checkout-button.mjs': {
      hashedName: 'checkout-button.def67890.mjs',
    },
    'checkout-button.cjs': {
      hashedName: 'checkout-button.0123abcd.cjs',
    },
  },
};

describe('semverPath', () => {
  it('builds a readable pinned CDN path for a bundle', () => {
    expect(semverPath('0.2.3', 'checkout-button.js')).toBe('/v0.2.3/checkout-button.js');
  });
});

describe('cdn urls', () => {
  it('builds full SemVer CDN links', () => {
    expect(semverUrl('0.2.3', 'checkout-button.js')).toBe('https://js.maytes.co/v0.2.3/checkout-button.js');
  });

  it('builds full hashed CDN links', () => {
    expect(hashedUrl('checkout-button.abc12345.js')).toBe('https://js.maytes.co/checkout-button.abc12345.js');
  });

  it('normalizes leading slashes', () => {
    expect(cdnUrl('/dev/checkout-button.js')).toBe('https://js.maytes.co/dev/checkout-button.js');
  });
});

describe('buildCdnConfig', () => {
  it('keeps evergreen on the dev channel only', () => {
    const { headers, redirects } = buildCdnConfig(INTEGRITY);

    expect(headers).toContain('/dev/*\n  Cache-Control: public, max-age=300');
    expect(redirects).toContain('/dev/checkout-button.js   /checkout-button.js   200');
    expect(headers).not.toContain('/v1/*');
    expect(redirects).not.toContain('/v1/checkout-button.js');
  });

  it('creates immutable semver aliases to the hashed bundles', () => {
    const { headers, redirects } = buildCdnConfig(INTEGRITY);

    expect(headers).toContain('/v0.2.3/checkout-button.js\n  Cache-Control: public, max-age=31536000, immutable');
    expect(redirects).toContain('/v0.2.3/checkout-button.js   /checkout-button.abc12345.js   200');
  });

  it('keeps hash links immutable', () => {
    const { headers } = buildCdnConfig(INTEGRITY);

    expect(headers).toContain('/checkout-button.abc12345.js\n  Cache-Control: public, max-age=31536000, immutable');
    expect(headers).toContain('/checkout-button.def67890.mjs\n  Cache-Control: public, max-age=31536000, immutable');
    expect(headers).toContain('/checkout-button.0123abcd.cjs\n  Cache-Control: public, max-age=31536000, immutable');
  });
});
