# CDN pin durability + `/v1` evergreen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** every SemVer/content-hash CDN pin this SDK has ever published stays live forever (fixes a confirmed production bug), and an opt-in `js.maytes.co/v1/checkout-button.js` evergreen alias is added on top of the same mechanism.

**Architecture:** every CI deploy re-hydrates every historical release's verified assets into `dist/` alongside the current build, from GitHub Releases (cross-checked against `CHANGELOG.md`'s recorded SRI, not just the release asset's own self-reported hash). `buildCdnConfig` takes the full list of releases instead of one and emits per-release `_redirects` entries plus one evergreen `_redirects` entry per major version. Cache-Control for both is provisioned as 2 fixed, regex-matched Cloudflare Cache Rules (via the Cloudflare API) instead of growing `_headers` — `_headers` has a hard 100-rule cap that the naive per-release design would have hit at ~15 releases.

**Tech Stack:** Node 20 (matches `.github/workflows/release.yml`), plain `.mjs`/`.d.mts` (no new runtime or dev dependencies — this repo hand-rolls small utilities rather than adding packages), Vitest for tests, `gh` CLI (already used in the workflow) and Cloudflare's REST API (new) for I/O.

**Spec:** [`docs/cdn-pin-durability-and-evergreen-v1.md`](../../cdn-pin-durability-and-evergreen-v1.md) — read this first; it has the full reasoning, the production evidence for the bug, and the Cloudflare-limits math. [`docs/cdn-versioning.md`](../../cdn-versioning.md)'s "Revisited (2026-09-18)" section has the product decision this implements.

## Global Constraints

- No new runtime or dev dependencies (this repo's "zero runtime dependencies" ethos extends to build scripts hand-rolling small utilities like SemVer comparison instead of pulling in the `semver` package).
- Every new `scripts/lib/*.mjs` file that a `src/test/*.test.ts` file imports needs a matching hand-written `.d.mts` — `tsconfig.json` excludes `scripts/` from `include`, but `src/test/*.test.ts` files are included and resolve imported `.mjs` files' types through their sibling `.d.mts`. Forgetting this reproduces the exact CI failure fixed in commit `532d604`.
- `Cache-Control: public, max-age=300` is the existing short-cache value (used today by `/dev/*`) — reuse it for the new `/v{major}/*` evergreen alias rather than inventing a new number.
- `Cache-Control: public, max-age=31536000, immutable` is the existing immutable-pin value — reused for the Cache Rules, not re-derived.
- Node scripts in this repo use `node:*` built-in imports, `execFileSync` (never `execSync` with string interpolation — this repo avoids shell-injection-prone patterns), and plain `readFileSync`/`JSON.parse` rather than a config-loading library.
- Test files live under `src/test/*.test.ts` (not colocated with the `scripts/` files they test) and are run with `npm run test:run -- <path>`; typecheck the whole repo with `npm run typecheck`.

---

## Task 1: `semver-lite` — pure version comparison and grouping

**Files:**
- Create: `scripts/lib/semver-lite.mjs`
- Create: `scripts/lib/semver-lite.d.mts`
- Test: `src/test/semver-lite.test.ts`

**Interfaces:**
- Produces: `compareVersions(a: string, b: string): number` (negative if `a < b`, positive if `a > b`, 0 if equal — numeric per-segment comparison, not lexicographic). `latestPerMajor(versions: string[]): Map<string, string>` (keyed by major-version string, e.g. `'1'`, valued by the highest full version seen for that major). Task 3 (`cdn-config.mjs`) consumes `latestPerMajor`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/test/semver-lite.test.ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/test/semver-lite.test.ts`
Expected: FAIL — `Cannot find module '../../scripts/lib/semver-lite.mjs'`

- [ ] **Step 3: Write the implementation**

```js
// scripts/lib/semver-lite.mjs
export function compareVersions(a, b) {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  const length = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < length; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function latestPerMajor(versions) {
  const byMajor = new Map();
  for (const version of versions) {
    const major = version.split('.')[0];
    const current = byMajor.get(major);
    if (current === undefined || compareVersions(version, current) > 0) {
      byMajor.set(major, version);
    }
  }
  return byMajor;
}
```

```ts
// scripts/lib/semver-lite.d.mts
export function compareVersions(a: string, b: string): number;
export function latestPerMajor(versions: string[]): Map<string, string>;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/test/semver-lite.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/semver-lite.mjs scripts/lib/semver-lite.d.mts src/test/semver-lite.test.ts
git commit -m "feat: add pure SemVer comparison/grouping helper for CDN release history"
```

---

## Task 2: `extractSriRecords` — read every release's SRI from CHANGELOG.md

**Files:**
- Modify: `scripts/lib/changelog.mjs`
- Modify: `scripts/lib/changelog.d.mts`
- Modify: `src/test/changelog.test.ts`

**Interfaces:**
- Consumes: `SRI_START_MARKER`, `SRI_END_MARKER` (already exported from this file).
- Produces: `extractSriRecords(changelog: string): Map<string, Record<string, string>>` — maps a version string to `{ sourceName: sriValue }`, for every `## <version>` section that has a `@hash-sri-start`/`@hash-sri-end` block. A version with no block is absent from the map (not an empty object). On a duplicated version heading, the first occurrence with a valid block wins (matches `findSectionBounds`'s existing "first header wins" behavior). Task 4 (`release-verification.mjs`, via Task 5's script) consumes this.

- [ ] **Step 1: Write the failing tests**

Add to the existing `src/test/changelog.test.ts`, updating its import line to include `extractSriRecords`:

```ts
import { describe, expect, it } from 'vitest';
import { extractSection, extractSriRecords, findSectionBounds, injectSriBlock } from '../../scripts/lib/changelog.mjs';
```

```ts
describe('extractSriRecords', () => {
  it('extracts SRI records for every version that has a block', () => {
    const changelog = [
      '# Changelog',
      '',
      '## 1.0.1',
      '',
      '<!-- @hash-sri-start -->',
      'checkout-button.js   sha384-BBB',
      'checkout-button.mjs  sha384-CCC',
      '<!-- @hash-sri-end -->',
      '',
      '## 1.0.0',
      '',
      'No SRI block backfilled yet.',
      '',
    ].join('\n');

    const records = extractSriRecords(changelog);
    expect(records.get('1.0.1')).toEqual({
      'checkout-button.js': 'sha384-BBB',
      'checkout-button.mjs': 'sha384-CCC',
    });
    expect(records.has('1.0.0')).toBe(false);
  });

  it('uses the first occurrence for a duplicated version heading', () => {
    const changelog = [
      '## 0.2.0',
      '<!-- @hash-sri-start -->',
      'checkout-button.js   sha384-FIRST',
      '<!-- @hash-sri-end -->',
      '',
      '## 0.2.0',
      '<!-- @hash-sri-start -->',
      'checkout-button.js   sha384-SECOND',
      '<!-- @hash-sri-end -->',
      '',
    ].join('\n');

    expect(extractSriRecords(changelog).get('0.2.0')).toEqual({ 'checkout-button.js': 'sha384-FIRST' });
  });

  it('returns an empty map for a changelog with no SRI blocks', () => {
    expect(extractSriRecords('# Changelog\n\n## 0.1.0\n\n- first\n').size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/test/changelog.test.ts`
Expected: FAIL — `extractSriRecords is not a function` (or `undefined`)

- [ ] **Step 3: Write the implementation**

```js
// scripts/lib/changelog.mjs — add below the existing exports
const VERSION_HEADING_RE = /^## (\S+)/gm;

export function extractSriRecords(changelog) {
  const records = new Map();
  const headings = [...changelog.matchAll(VERSION_HEADING_RE)];

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const version = heading[1];
    const start = heading.index ?? 0;
    const end = i + 1 < headings.length ? (headings[i + 1].index ?? changelog.length) : changelog.length;
    const section = changelog.slice(start, end);

    const sriStart = section.indexOf(SRI_START_MARKER);
    const sriEnd = section.indexOf(SRI_END_MARKER);
    if (sriStart === -1 || sriEnd === -1 || sriEnd < sriStart) continue;
    if (records.has(version)) continue;

    const block = section.slice(sriStart, sriEnd);
    const files = {};
    for (const match of block.matchAll(/^(\S+)\s+(sha384-\S+)\s*$/gm)) {
      files[match[1]] = match[2];
    }
    if (Object.keys(files).length > 0) {
      records.set(version, files);
    }
  }

  return records;
}
```

```ts
// scripts/lib/changelog.d.mts — add
export function extractSriRecords(changelog: string): Map<string, Record<string, string>>;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/test/changelog.test.ts`
Expected: PASS (all existing tests plus the 3 new ones)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/changelog.mjs scripts/lib/changelog.d.mts src/test/changelog.test.ts
git commit -m "feat: extract every release's recorded SRI from CHANGELOG.md"
```

---

## Task 3: `buildCdnConfig` — multi-release contract, evergreen alias, fixed headers

**Files:**
- Modify: `scripts/lib/cdn-config.mjs`
- Modify: `scripts/lib/cdn-config.d.mts`
- Modify: `src/test/cdn-config.test.ts` (full rewrite of the `buildCdnConfig` describe block and the guard test; the `semverPath`/`cdn urls` describe blocks gain new cases)

**Interfaces:**
- Consumes: `latestPerMajor` from Task 1's `scripts/lib/semver-lite.mjs`.
- Produces: `majorPath(version: string, sourceName: string): string`, `majorUrl(version: string, sourceName: string): string`. `buildCdnConfig(releases: Array<{ version: string; files: Record<string, { hashedName: string }> }>): { headers: string; redirects: string }` replaces the old single-`integrity`-object signature. Task 6 (`scripts/cdn-config.mjs`) and Task 5 (via the manifest it writes) depend on this exact shape.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `src/test/cdn-config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildCdnConfig,
  cdnUrl,
  hashedUrl,
  majorPath,
  majorUrl,
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

  it('builds full evergreen CDN links', () => {
    expect(majorUrl('1.0.1', 'checkout-button.js')).toBe('https://js.maytes.co/v1/checkout-button.js');
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

  // Deliberately reversed 2026-09-18: /v1 is now a supported, documented,
  // opt-in evergreen channel — see docs/cdn-versioning.md's "Revisited"
  // section for why. This test used to assert the opposite.
  it('keeps the fixed header set regardless of how many releases are tracked', () => {
    const single = buildCdnConfig([RELEASE_101]).headers;
    const many = buildCdnConfig([RELEASE_101, RELEASE_100, RELEASE_200]).headers;
    // Regression test for Cloudflare's 100-header-rule ceiling: headers must
    // never grow with release count, or deploys start hard-failing past ~15
    // releases. Cache-Control for pins/evergreen now lives in Cloudflare
    // Cache Rules (scripts/ensure-cdn-cache-rules.mjs), not here.
    expect(many).toBe(single);
    expect(many).toContain('/dev/*');
    expect(many).toContain('/integrity.json');
    expect(many).not.toContain('immutable');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/test/cdn-config.test.ts`
Expected: FAIL — `majorPath is not a function`, and `buildCdnConfig` called with an array throws or produces wrong output (old signature expects a single object with a `.files` property)

- [ ] **Step 3: Write the implementation**

```js
// scripts/lib/cdn-config.mjs — full replacement
import { latestPerMajor } from './semver-lite.mjs';

export const DEV_CHANNEL_PREFIX = '/dev';
export const CDN_ORIGIN = 'https://js.maytes.co';

const CACHE_SHORT = 'Cache-Control: public, max-age=300';

export function cdnUrl(path) {
  return `${CDN_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

export function semverPath(version, sourceName) {
  return `/v${version}/${sourceName}`;
}

export function semverUrl(version, sourceName) {
  return cdnUrl(semverPath(version, sourceName));
}

export function hashedUrl(hashedName) {
  return cdnUrl(hashedName);
}

export function majorPath(version, sourceName) {
  const major = version.split('.')[0];
  return `/v${major}/${sourceName}`;
}

export function majorUrl(version, sourceName) {
  return cdnUrl(majorPath(version, sourceName));
}

export function buildCdnConfig(releases) {
  const current = releases[0];

  const headers = `/*
  Access-Control-Allow-Origin: *
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

${DEV_CHANNEL_PREFIX}/*
  ${CACHE_SHORT}

/integrity.json
  Cache-Control: public, max-age=60
`;

  const devRedirects = Object.keys(current.files).map(
    (sourceName) => `${DEV_CHANNEL_PREFIX}/${sourceName}   /${sourceName}   200`,
  );

  const pinRedirects = releases.flatMap(({ version, files }) =>
    Object.entries(files).map(
      ([sourceName, meta]) => `${semverPath(version, sourceName)}   /${meta.hashedName}   200`,
    ),
  );

  const releaseByVersion = new Map(releases.map((release) => [release.version, release]));
  const latestByMajor = latestPerMajor(releases.map((release) => release.version));

  const evergreenRedirects = [...latestByMajor.values()].flatMap((version) => {
    const release = releaseByVersion.get(version);
    return Object.entries(release.files).map(
      ([sourceName, meta]) => `${majorPath(version, sourceName)}   /${meta.hashedName}   200`,
    );
  });

  const redirects = [...devRedirects, ...pinRedirects, ...evergreenRedirects].join('\n') + '\n';

  return { headers, redirects };
}
```

```ts
// scripts/lib/cdn-config.d.mts — full replacement
export const DEV_CHANNEL_PREFIX: '/dev';
export const CDN_ORIGIN: 'https://js.maytes.co';

export function cdnUrl(path: string): string;

export function semverPath(version: string, sourceName: string): string;

export function semverUrl(version: string, sourceName: string): string;

export function hashedUrl(hashedName: string): string;

export function majorPath(version: string, sourceName: string): string;

export function majorUrl(version: string, sourceName: string): string;

export function buildCdnConfig(
  releases: Array<{
    version: string;
    files: Record<string, { hashedName: string }>;
  }>,
): { headers: string; redirects: string };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/test/cdn-config.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/cdn-config.mjs scripts/lib/cdn-config.d.mts src/test/cdn-config.test.ts
git commit -m "feat: buildCdnConfig tracks every release, adds /v{major} evergreen alias"
```

---

## Task 4: `release-verification` — pure hash-check and tag-coverage sanity check

**Files:**
- Create: `scripts/lib/release-verification.mjs`
- Create: `scripts/lib/release-verification.d.mts`
- Test: `src/test/release-verification.test.ts`

**Interfaces:**
- Produces: `verifyReleaseHash(input: { tag, sourceName, recomputedSri, changelogSri, integritySri }): { ok: true } | { ok: false; message: string }` and `checkTagCoverage(input: { tagCount, changelogVersionCount }): { ok: true } | { ok: false; message: string }`. Task 5's `scripts/rehydrate-cdn-history.mjs` consumes both.

- [ ] **Step 1: Write the failing tests**

```ts
// src/test/release-verification.test.ts
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

  it('fails when CHANGELOG has history but no tags were fetched', () => {
    const result = checkTagCoverage({ tagCount: 0, changelogVersionCount: 3 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('fetch-tags');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/test/release-verification.test.ts`
Expected: FAIL — `Cannot find module '../../scripts/lib/release-verification.mjs'`

- [ ] **Step 3: Write the implementation**

```js
// scripts/lib/release-verification.mjs
export function verifyReleaseHash({ tag, sourceName, recomputedSri, changelogSri, integritySri }) {
  const reference = changelogSri ?? integritySri;
  if (recomputedSri !== reference) {
    return {
      ok: false,
      message: `[rehydrate-cdn-history] MISMATCH ${tag} ${sourceName}: got ${recomputedSri}, expected ${reference}`,
    };
  }
  return { ok: true };
}

export function checkTagCoverage({ tagCount, changelogVersionCount }) {
  if (changelogVersionCount >= 2 && tagCount === 0) {
    return {
      ok: false,
      message:
        `[rehydrate-cdn-history] CHANGELOG.md records ${changelogVersionCount} version(s) but 0 git tags were ` +
        `found — tags are probably not being fetched (check 'fetch-tags: true' on the checkout step).`,
    };
  }
  return { ok: true };
}
```

```ts
// scripts/lib/release-verification.d.mts
export function verifyReleaseHash(input: {
  tag: string;
  sourceName: string;
  recomputedSri: string;
  changelogSri: string | undefined;
  integritySri: string;
}): { ok: true } | { ok: false; message: string };

export function checkTagCoverage(input: {
  tagCount: number;
  changelogVersionCount: number;
}): { ok: true } | { ok: false; message: string };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/test/release-verification.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/release-verification.mjs scripts/lib/release-verification.d.mts src/test/release-verification.test.ts
git commit -m "feat: add pure hash-verification and tag-coverage checks for CDN history rehydration"
```

---

## Task 5: `rehydrate-cdn-history.mjs` — the I/O shell

**Files:**
- Create: `scripts/rehydrate-cdn-history.mjs`
- Modify: `package.json` (add a script entry)

**Interfaces:**
- Consumes: `extractSriRecords` (Task 2), `verifyReleaseHash` + `checkTagCoverage` (Task 4).
- Produces: `dist/_releases-manifest.json` (a JSON array of every release's `integrity.json` shape, current release first) and copies every historical release's verified bundle + map files into `dist/`. Task 6's `scripts/cdn-config.mjs` consumes the manifest file.

This task's shell-out logic (`git`, `gh`, filesystem) is not unit-tested per the spec's own testing plan — the pure logic it calls was already tested in Task 4. Verification here is a manual run against this real repository's actual state instead of a mocked unit test.

- [ ] **Step 1: Write the implementation**

```js
// scripts/rehydrate-cdn-history.mjs
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSriRecords } from './lib/changelog.mjs';
import { checkTagCoverage, verifyReleaseHash } from './lib/release-verification.mjs';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const sdkRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(sdkRoot, 'dist');
const cacheRoot = resolve(sdkRoot, '.cdn-history-cache');

const pkg = readJson(resolve(sdkRoot, 'package.json'));

const currentIntegrityPath = resolve(dist, 'integrity.json');
if (!existsSync(currentIntegrityPath)) {
  console.error('[rehydrate-cdn-history] dist/integrity.json missing — run "npm run build" first');
  process.exit(1);
}
const currentIntegrity = readJson(currentIntegrityPath);

const tags = execFileSync('git', ['tag', '-l', 'v*'], { cwd: sdkRoot, encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .filter((tag) => tag !== `v${pkg.version}`);

const changelogPath = resolve(sdkRoot, 'CHANGELOG.md');
const changelogText = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf8') : '';
const changelogVersionCount = [...changelogText.matchAll(/^## \S+/gm)].length;

const coverage = checkTagCoverage({ tagCount: tags.length, changelogVersionCount });
if (!coverage.ok) {
  console.error(coverage.message);
  process.exit(1);
}

const sriRecords = extractSriRecords(changelogText);
const releases = [currentIntegrity];

for (const tag of tags) {
  const version = tag.slice(1);
  const tagCacheDir = resolve(cacheRoot, tag);
  mkdirSync(tagCacheDir, { recursive: true });

  const integrityPath = resolve(tagCacheDir, 'integrity.json');
  if (!existsSync(integrityPath)) {
    execFileSync(
      'gh',
      [
        'release', 'download', tag,
        '--pattern', 'integrity.json',
        '--pattern', 'checkout-button.*',
        '--dir', tagCacheDir,
        '--clobber',
      ],
      { cwd: sdkRoot, stdio: 'inherit' },
    );
  }

  const integrity = readJson(integrityPath);
  const changelogSriForVersion = sriRecords.get(version);

  for (const [sourceName, meta] of Object.entries(integrity.files)) {
    const bundlePath = resolve(tagCacheDir, meta.hashedName);
    const bytes = readFileSync(bundlePath);
    const recomputedSri = `sha384-${createHash('sha384').update(bytes).digest('base64')}`;

    const result = verifyReleaseHash({
      tag,
      sourceName,
      recomputedSri,
      changelogSri: changelogSriForVersion?.[sourceName],
      integritySri: meta.sri,
    });
    if (!result.ok) {
      console.error(result.message);
      process.exit(1);
    }

    copyFileSync(bundlePath, resolve(dist, meta.hashedName));
    const mapPath = `${bundlePath}.map`;
    if (existsSync(mapPath)) {
      copyFileSync(mapPath, resolve(dist, `${meta.hashedName}.map`));
    }
  }

  releases.push(integrity);
}

writeFileSync(resolve(dist, '_releases-manifest.json'), JSON.stringify(releases, null, 2));
console.log(
  `[rehydrate-cdn-history] verified and staged ${releases.length} release(s) (${tags.length} historical + current)`,
);
```

Add to `package.json`'s `"scripts"` block, next to the existing `"cdn-config"` entry:

```json
"cdn-rehydrate": "node scripts/rehydrate-cdn-history.mjs",
```

- [ ] **Step 2: Verify manually against this repository's real state**

This repo currently has 2 tags (`v1.0.0`, `v1.0.1`). Run a local build first, then the script:

```bash
npm run build
node scripts/rehydrate-cdn-history.mjs
```

Expected: since `gh` needs a real GitHub Release to download from and this is a local, uncommitted checkout, this step should be validated in CI on the next actual release rather than requiring local `gh` auth — if run locally without `gh` authenticated for this repo, it will fail at the `gh release download` call for tag `v1.0.0` (the only historical tag once the current `package.json` version is excluded). Confirm the failure is exactly that (an auth/network error from `gh`, not a crash elsewhere in the script — e.g. not a `TypeError` from malformed logic), which confirms the script's control flow up to that point (tag listing, current-version exclusion, coverage check, CHANGELOG parsing) is correct. Full end-to-end verification (including a successful `gh` download and hash check) happens in Task 8's CI wiring, on the next real release.

- [ ] **Step 3: Commit**

```bash
git add scripts/rehydrate-cdn-history.mjs package.json
git commit -m "feat: rehydrate every historical release's verified assets into dist on deploy"
```

---

## Task 6: `scripts/cdn-config.mjs` — read the full release history

**Files:**
- Modify: `scripts/cdn-config.mjs`

**Interfaces:**
- Consumes: `buildCdnConfig` (Task 3, now takes `releases: Release[]`), `dist/_releases-manifest.json` (Task 5's output, optional).

- [ ] **Step 1: Write the implementation**

```js
// scripts/cdn-config.mjs — full replacement
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCdnConfig } from './lib/cdn-config.mjs';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

const integrityPath = resolve(dist, 'integrity.json');
if (!existsSync(integrityPath)) {
  console.error('[cdn-config] dist/integrity.json missing — run "npm run build" first');
  process.exit(1);
}
const integrity = JSON.parse(readFileSync(integrityPath, 'utf8'));

const manifestPath = resolve(dist, '_releases-manifest.json');
const hasManifest = existsSync(manifestPath);
const releases = hasManifest ? JSON.parse(readFileSync(manifestPath, 'utf8')) : [integrity];

const { headers, redirects } = buildCdnConfig(releases);

writeFileSync(join(dist, '_headers'), headers);
writeFileSync(join(dist, '_redirects'), redirects);
console.log(
  `[cdn-config] wrote dist/_headers and dist/_redirects for ${releases.length} release(s)` +
    (hasManifest
      ? ''
      : ' (no _releases-manifest.json — current release only; run "npm run cdn-rehydrate" first for full history)'),
);
```

- [ ] **Step 2: Verify manually**

```bash
npm run build
node scripts/cdn-config.mjs
cat dist/_headers
cat dist/_redirects
```

Expected: the fallback path runs (no `_releases-manifest.json` present locally) — output notes "current release only"; `dist/_headers` contains exactly the 3 fixed blocks (`/*`, `/dev/*`, `/integrity.json`), no `immutable` anywhere; `dist/_redirects` contains the dev-channel row, the current version's SemVer-pin rows, and one `/v1/...` evergreen row per bundle kind pointing at the current build's hashed files.

- [ ] **Step 3: Commit**

```bash
git add scripts/cdn-config.mjs
git commit -m "feat: cdn-config reads the full release manifest when available"
```

---

## Task 7: Cloudflare Cache Rules — fixed, regex-matched, provisioned via API

**Files:**
- Create: `scripts/lib/cdn-cache-rules.mjs`
- Create: `scripts/lib/cdn-cache-rules.d.mts`
- Create: `scripts/ensure-cdn-cache-rules.mjs`
- Modify: `package.json` (add a script entry)
- Test: `src/test/cdn-cache-rules.test.ts`

**Interfaces:**
- Produces: `CACHE_RULES` (the 2-rule desired-state constant) and `rulesetNeedsUpdate(currentRules, desiredRules?): boolean`, both pure and consumed by `scripts/ensure-cdn-cache-rules.mjs`.

**Known residual risk (carried over from the spec, not resolved by this task):** the exact Cloudflare Ruleset Engine API request/response shape below is written from Cloudflare's documented `http_request_cache_settings` phase, but has not been verified against this repository's real zone (no API access available while writing this plan). Step 3 below is a live-verification step, not optional cleanup.

- [ ] **Step 1: Write the failing tests**

```ts
// src/test/cdn-cache-rules.test.ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/test/cdn-cache-rules.test.ts`
Expected: FAIL — `Cannot find module '../../scripts/lib/cdn-cache-rules.mjs'`

- [ ] **Step 3: Write the implementation**

```js
// scripts/lib/cdn-cache-rules.mjs
export const CACHE_RULES = [
  {
    id: 'checkout-button-immutable-pins',
    expression:
      '(http.request.uri.path matches "^/v[0-9]+\\.[0-9]+\\.[0-9]+/") or (http.request.uri.path matches "^/checkout-button\\.[0-9a-f]{8}\\.")',
    cacheControl: 'public, max-age=31536000, immutable',
  },
  {
    id: 'checkout-button-evergreen-major',
    expression: '(http.request.uri.path matches "^/v[0-9]+/")',
    cacheControl: 'public, max-age=300',
  },
];

export function rulesetNeedsUpdate(currentRules, desiredRules = CACHE_RULES) {
  if (currentRules.length !== desiredRules.length) return true;
  return desiredRules.some((desired) => {
    const current = currentRules.find((rule) => rule.id === desired.id);
    if (current === undefined) return true;
    return current.expression !== desired.expression || current.cacheControl !== desired.cacheControl;
  });
}
```

```ts
// scripts/lib/cdn-cache-rules.d.mts
export interface CacheRule {
  id: string;
  expression: string;
  cacheControl: string;
}

export const CACHE_RULES: CacheRule[];

export function rulesetNeedsUpdate(currentRules: CacheRule[], desiredRules?: CacheRule[]): boolean;
```

```js
// scripts/ensure-cdn-cache-rules.mjs
import { CACHE_RULES, rulesetNeedsUpdate } from './lib/cdn-cache-rules.mjs';

const zoneId = process.env.CLOUDFLARE_ZONE_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
if (!zoneId || !apiToken) {
  console.error('[ensure-cdn-cache-rules] CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN are required');
  process.exit(1);
}

const rulesetUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/phases/http_request_cache_settings/entrypoint`;
const requestHeaders = {
  Authorization: `Bearer ${apiToken}`,
  'Content-Type': 'application/json',
};

function browserMaxAge(cacheControl) {
  const match = cacheControl.match(/max-age=(\d+)/);
  if (match === null) {
    throw new Error(`[ensure-cdn-cache-rules] cacheControl has no max-age: ${cacheControl}`);
  }
  return Number(match[1]);
}

const getResponse = await fetch(rulesetUrl, { headers: requestHeaders });
const getBody = await getResponse.json();

// A zone with no cache-settings ruleset configured yet returns an error
// rather than an empty ruleset — treat that the same as "no rules configured".
const currentRules = getResponse.ok
  ? getBody.result.rules.map((rule) => ({
      id: rule.description,
      expression: rule.expression,
      cacheControl: `public, max-age=${rule.action_parameters?.browser_ttl?.default ?? 0}`,
    }))
  : [];

if (getResponse.ok && !rulesetNeedsUpdate(currentRules, CACHE_RULES)) {
  console.log('[ensure-cdn-cache-rules] already up to date, no changes needed');
  process.exit(0);
}

const putResponse = await fetch(rulesetUrl, {
  method: 'PUT',
  headers: requestHeaders,
  body: JSON.stringify({
    rules: CACHE_RULES.map((rule) => ({
      description: rule.id,
      expression: rule.expression,
      action: 'set_cache_settings',
      action_parameters: {
        cache: true,
        edge_ttl: { mode: 'override_origin', default: 31536000 },
        browser_ttl: { mode: 'override_origin', default: browserMaxAge(rule.cacheControl) },
      },
    })),
  }),
});

if (!putResponse.ok) {
  console.error('[ensure-cdn-cache-rules] failed to update cache rules:', await putResponse.text());
  process.exit(1);
}

console.log('[ensure-cdn-cache-rules] cache rules updated');
```

Add to `package.json`'s `"scripts"` block:

```json
"cdn-cache-rules": "node scripts/ensure-cdn-cache-rules.mjs",
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/test/cdn-cache-rules.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 6: Live-verify against the real Cloudflare zone (required before this ships, not optional)**

With a `CLOUDFLARE_API_TOKEN` scoped for Cache Rules / Ruleset Engine write access and the real `CLOUDFLARE_ZONE_ID` for `maytes.co`:

```bash
CLOUDFLARE_ZONE_ID=<real zone id> CLOUDFLARE_API_TOKEN=<real scoped token> node scripts/ensure-cdn-cache-rules.mjs
```

Then confirm in the Cloudflare dashboard (Rules → Cache Rules for the zone) that exactly 2 rules exist, matching `CACHE_RULES`' expressions and cache TTLs, and test live: request an existing pinned URL (e.g. `https://js.maytes.co/v1.0.1/checkout-button.js`) and confirm the response's `Cache-Control` header now comes from the Cache Rule rather than `_headers`. If the request/response field names in Step 3's implementation don't match Cloudflare's actual current API (this is the flagged residual risk), fix them here based on the real API's error messages or response shape before proceeding.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/cdn-cache-rules.mjs scripts/lib/cdn-cache-rules.d.mts scripts/ensure-cdn-cache-rules.mjs package.json src/test/cdn-cache-rules.test.ts
git commit -m "feat: provision fixed, regex-matched Cloudflare Cache Rules for CDN pins and evergreen"
```

---

## Task 8: Wire it into `release.yml`

**Files:**
- Modify: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: `scripts/rehydrate-cdn-history.mjs` (Task 5), `scripts/cdn-config.mjs` (Task 6), `scripts/ensure-cdn-cache-rules.mjs` (Task 7).

**Prerequisites to confirm before merging this task (not code changes, but blocking):**
- `CLOUDFLARE_API_TOKEN` (existing secret) needs Cache Rules / Ruleset Engine write scope added.
- A new `CLOUDFLARE_ZONE_ID` secret needs to be created for the `maytes.co` zone.

- [ ] **Step 1: Add `fetch-tags: true` to both jobs' checkout step**

In the `release` job:

```yaml
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          fetch-tags: true
```

In the `cdn-deploy` job:

```yaml
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          fetch-tags: true
```

(The `cdn-deploy` job currently has no `with:` block on its checkout step at all — add one with both keys.)

- [ ] **Step 2: Add the incrementally-growing history cache and the rehydrate step to the `release` job**

Insert between the existing "Attach release assets" step and "Deploy bundle to CDN" step:

```yaml
      - name: Cache CDN release history
        uses: actions/cache@v4
        with:
          path: .cdn-history-cache
          key: cdn-history-${{ github.run_id }}
          restore-keys: |
            cdn-history-

      - name: Rehydrate CDN release history
        if: steps.changesets.outputs.published == 'true'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: node scripts/rehydrate-cdn-history.mjs
```

- [ ] **Step 3: Add the same cache + rehydrate steps to the `cdn-deploy` job**

Insert between "Build" and "Deploy bundle to CDN":

```yaml
      - name: Cache CDN release history
        uses: actions/cache@v4
        with:
          path: .cdn-history-cache
          key: cdn-history-${{ github.run_id }}
          restore-keys: |
            cdn-history-

      - name: Rehydrate CDN release history
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: node scripts/rehydrate-cdn-history.mjs
```

- [ ] **Step 4: Add the Cache Rules provisioning step to both jobs' CDN deploy sequence**

In both jobs, alongside the existing `node scripts/cdn-config.mjs` line (order relative to `wrangler pages deploy` doesn't matter — Cache Rules are zone-level, not deployment-scoped):

```yaml
      - name: Deploy bundle to CDN
        if: steps.changesets.outputs.published == 'true'
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_ZONE_ID: ${{ secrets.CLOUDFLARE_ZONE_ID }}
        run: |
          node scripts/cdn-config.mjs
          npx wrangler@3 pages deploy dist --project-name=checkout-button --branch=main
          node scripts/ensure-cdn-cache-rules.mjs
```

And in the `cdn-deploy` job (this one has no `if:` condition today — keep it that way):

```yaml
      - name: Deploy bundle to CDN
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_ZONE_ID: ${{ secrets.CLOUDFLARE_ZONE_ID }}
        run: |
          node scripts/cdn-config.mjs
          npx wrangler@3 pages deploy dist --project-name=checkout-button --branch=main
          node scripts/ensure-cdn-cache-rules.mjs
```

- [ ] **Step 5: Verify the full workflow file is valid YAML and matches the existing style**

Run: `cat .github/workflows/release.yml` and read it end to end — confirm indentation is consistent with the surrounding steps (2-space, matching the existing file), both jobs were updated symmetrically, and no existing step was accidentally removed.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: rehydrate CDN release history and provision Cache Rules on every deploy"
```

---

## Task 9: README — document the evergreen URL and CSP guidance

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Insert the new subsection**

In `## Install`, immediately after the existing "Use a pinned URL in every environment, development included — pinning is what makes the bytes you tested the bytes your shoppers get." line (currently `README.md:61`) and before `### npm` (currently `README.md:63`):

```markdown

### Evergreen (auto-updating) URL

Pinning (above) is the default and the recommended choice for production. If you'd rather trade that guarantee for automatic updates — accepting that a bad release reaches you immediately, with no ability to stay on a known-good build — use the major-version alias instead:

```html
<script src="https://js.maytes.co/v1/checkout-button.js"
        crossorigin="anonymous"></script>
```

This URL has no `integrity` attribute, and can't have one: it moves to whichever `1.x` release is newest (~5 minute edge cache), so the bytes behind it change without notice. Restrict which origins your page trusts via CSP instead of a content hash:

```
Content-Security-Policy: script-src 'self' https://js.maytes.co;
```

This isn't a way to get bug fixes faster than pinning — a fix ships the same way either way (a new release), and if you're pinned, bumping your pin to the new version is exactly as fast as staying on `/v1/` would have been. What you're actually trading is safety: on `/v1/`, a bad release reaches you the moment it ships, with no way to stay back on the last good build. `https://js.maytes.co/integrity.json` always reflects whatever `/v1/` currently serves, if you want to poll it and alert on unexpected changes yourself.

`/v1/` only ever tracks `1.x`. When a breaking `2.0.0` ships, `/v1/` keeps resolving to the last `1.x` release rather than disappearing or jumping to `2.x` — move to `/v2/checkout-button.js` explicitly when you're ready.
```

- [ ] **Step 2: Verify placement and rendering**

Run: `git diff README.md` and confirm the new section sits between the two lines named in Step 1, doesn't disturb the `<!-- @cdn-example-start -->`/`<!-- @cdn-example-end -->` markers above it (those are regenerated by `scripts/lib/readme.mjs` and must stay untouched), and that all fenced code blocks are properly closed.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document the opt-in /v1 evergreen URL and its CSP guidance"
```

---

## Post-implementation checklist (not a task — do after Task 9)

- [ ] Confirm `CLOUDFLARE_API_TOKEN` has been given Cache Rules / Ruleset Engine write scope (Task 7/8 prerequisite).
- [ ] Confirm the `CLOUDFLARE_ZONE_ID` secret has been added to the repo (Task 7/8 prerequisite).
- [ ] Run `npm run test:run` and `npm run typecheck` at the repo root once, after all 9 tasks, to catch any cross-task interaction the per-task checks missed.
- [ ] On the next real release, watch the `release` job's "Rehydrate CDN release history" and "Deploy bundle to CDN" steps succeed, then re-run the exact `curl` verification from `docs/cdn-pin-durability-and-evergreen-v1.md` (cache-busted requests to `v1.0.0/checkout-button.js` and `checkout-button.3cf081dc.js`) to confirm they now return 200 instead of 404, and that `https://js.maytes.co/v1/checkout-button.js` resolves.
