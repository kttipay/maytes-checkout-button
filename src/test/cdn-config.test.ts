import { describe, expect, it } from 'vitest';
import {
  buildCdnConfig,
  cdnUrl,
  hashedUrl,
  majorPath,
  semverPath,
  semverUrl,
} from '../../scripts/lib/cdn-config.mjs';

const RELEASE_101 = {
  version: '1.0.1',
  files: {
    'checkout-button.js': { hashedName: 'checkout-button.abc12345.js' },
    'checkout-button.mjs': { hashedName: 'checkout-button.def67890.mjs' },
    'checkout-button.cjs': { hashedName: 'checkout-button.0123abcd.cjs' },
  },
};

const RELEASE_100 = {
  version: '1.0.0',
  files: {
    'checkout-button.js': { hashedName: 'checkout-button.aaaa1111.js' },
    'checkout-button.mjs': { hashedName: 'checkout-button.bbbb2222.mjs' },
    'checkout-button.cjs': { hashedName: 'checkout-button.cccc3333.cjs' },
  },
};

const RELEASE_200 = {
  version: '2.0.0',
  files: {
    'checkout-button.js': { hashedName: 'checkout-button.eeee4444.js' },
    'checkout-button.mjs': { hashedName: 'checkout-button.ffff5555.mjs' },
    'checkout-button.cjs': { hashedName: 'checkout-button.aaaa6666.cjs' },
  },
};

describe('semverPath', () => {
  it('builds a readable pinned CDN path for a bundle', () => {
    expect(semverPath('0.2.3', 'checkout-button.js')).toBe('/v0.2.3/checkout-button.js');
  });
});

describe('majorPath', () => {
  it('builds the evergreen alias path from a full version', () => {
    expect(majorPath('1.0.1', 'checkout-button.js')).toBe('/v1/checkout-button.js');
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
  it('redirects the dev channel to the current (first) release only', () => {
    const { redirects } = buildCdnConfig([RELEASE_101, RELEASE_100]);
    expect(redirects).toContain('/dev/checkout-button.js   /checkout-button.js   200');
  });

  it('creates a pinned SemVer redirect for every release, not just the latest', () => {
    const { redirects } = buildCdnConfig([RELEASE_101, RELEASE_100]);
    expect(redirects).toContain('/v1.0.1/checkout-button.js   /checkout-button.abc12345.js   200');
    expect(redirects).toContain('/v1.0.0/checkout-button.js   /checkout-button.aaaa1111.js   200');
  });

  it('creates exactly one evergreen redirect per major, pointing at its highest version', () => {
    const { redirects } = buildCdnConfig([RELEASE_101, RELEASE_100, RELEASE_200]);
    expect(redirects).toContain('/v1/checkout-button.js   /checkout-button.abc12345.js   200');
    expect(redirects).not.toContain('/v1/checkout-button.js   /checkout-button.aaaa1111.js   200');
    expect(redirects).toContain('/v2/checkout-button.js   /checkout-button.eeee4444.js   200');
  });

  it('keeps the fixed header set regardless of how many releases are tracked', () => {
    const single = buildCdnConfig([RELEASE_101]).headers;
    const many = buildCdnConfig([RELEASE_101, RELEASE_100, RELEASE_200]).headers;
    expect(many).toBe(single);
    expect(many).toContain('/dev/*');
    expect(many).toContain('/integrity.json');
    expect(many).not.toContain('immutable');
  });
});
