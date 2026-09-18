# CDN pin durability + `/v1` evergreen — implementation spec

> Implements the "Revisited (2026-09-18)" decision in [`cdn-versioning.md`](./cdn-versioning.md). Read that first for *why*; this is *how*.

## Problem 1 (bug, confirmed in production): pins don't survive a release

`cdn-config.mjs` writes `dist/_headers`/`dist/_redirects` from a single `dist/integrity.json` — the release currently being built. `wrangler pages deploy dist` ships that as a full snapshot, and a Cloudflare Pages custom domain serves only the latest deployment's asset tree, not the union of every deployment ever made. So every prior release's SemVer pin and content-hash pin stop existing at the origin the moment the next version deploys.

Confirmed live, 2026-09-18 (cache-busted to bypass Cloudflare's edge cache and hit the real origin):

```
$ curl -sI "https://js.maytes.co/checkout-button.3cf081dc.js?cb=<random>"   # 1.0.0's hashed bundle
HTTP/2 404
cf-cache-status: BYPASS

$ curl -sI "https://js.maytes.co/v1.0.0/checkout-button.js?cb=<random>"     # 1.0.0's SemVer pin
HTTP/2 404
cf-cache-status: BYPASS
```

Without cache-busting, `v1.0.0/checkout-button.js` still returns 200 — a stale edge-cache entry left over from before the `1.0.1` deploy (`age: 259438`s at time of testing). That entry will keep serving correctly until it's evicted (LRU pressure, a cache purge, or simply a request from a PoP that never cached it) and then silently 404, matching what the hashed URL already does everywhere. This directly contradicts `README.md`'s "pin a release by SemVer or content hash... pinning is what makes the bytes you tested the bytes your shoppers get," and the CHANGELOG's 1.0.0 links are already dead in practice.

## Problem 2 (feature): an opt-in evergreen alias

Per the revisited decision: add `js.maytes.co/v1/checkout-button.js` (and `.mjs`/`.cjs`) as an always-latest-1.x alias, no `integrity` possible, documented as an explicit trade-off — not the default, not a hot-fix mechanism.

## Unified mechanism

Both problems are the same underlying gap: `cdn-config.mjs` only ever sees *one* release. Fix that once:

1. Every deploy re-hydrates every historical release's verified assets into `dist/` alongside the current build.
2. `buildCdnConfig` takes the full list of releases instead of one, and derives `_redirects` (URL → hashed-file rewrites, one set per release) from it.
3. Cache-Control assignment for those URLs is **not** done per-release in `_headers` — see "Why cache-control moves to Cloudflare Cache Rules" below, this was a real ceiling that would have broken future deploys.

### Why cache-control moves to Cloudflare Cache Rules, not `_headers`

Cloudflare Pages caps `_headers` at **100 rules total**. The original version of this spec added 6 header rules per release (SemVer path + hash path × 3 bundle kinds: `.js`/`.mjs`/`.cjs`). With ~6 more fixed rules (`/*`, `/dev/*`, `/integrity.json`), that's `(100 - 6) / 6 ≈ 15 releases` before `wrangler pages deploy` starts **hard-failing every deploy** — Cloudflare validates `_headers` at deploy time and rejects the whole deployment over the limit, it doesn't truncate quietly. This repo is already at 2 releases within its first couple of weeks, so 15 is a near-term wall. Cloudflare's `_headers` syntax can't route around it either — only a single *trailing* splat (`/path/*`) is supported, not a mid-segment wildcard like `/checkout-button.*.js`, so there's no way to collapse "one rule per release" into "one rule for all releases" within that file.

`_redirects` doesn't have this problem: it allows 2,000 *static* (exact literal source → exact literal target, which is what ours are) redirects, so 3 per release supports ~600+ releases before it becomes a concern — not the binding constraint.

**Fix:** stop declaring Cache-Control in the generated `_headers` file for anything release-shaped. Instead, provision exactly **2 fixed Cloudflare Ruleset Engine Cache Rules**, matched by regex against the URL shape rather than enumerated per release, via the Cloudflare API:

1. `http.host eq "js.maytes.co"` and (`^/v[0-9]+\.[0-9]+\.[0-9]+/` **or** `^/checkout-button\.[0-9a-f]{8}\.`) → `Cache-Control: public, max-age=31536000` (edge + browser TTL both one year)
2. `http.host eq "js.maytes.co"` and `^/v[0-9]+/` → `Cache-Control: public, max-age=300`

Both rules are scoped to the `js.maytes.co` host explicitly — the zone (`maytes.co`) may serve other hostnames, and a path-only match could otherwise apply this Cache-Control to an unrelated route on another subdomain.

**Live-verified limitation:** the Ruleset Engine's `set_cache_settings` action has no field for the literal `immutable` directive — `action_parameters.cache_control_directives` (what an earlier draft of this design assumed) is rejected outright (`"invalid JSON: unknown field \"cache_control_directives\""`, confirmed against the real `maytes.co` zone). Pins get `max-age=31536000` via `edge_ttl`/`browser_ttl` only, not the `immutable` token. Functionally this is close (nothing revalidates before a year passes either way), but delivering `immutable` literally would need a separate Response Header Transform Rule (`http_response_headers` phase) layered on top — not implemented here; a follow-up if it's ever worth the extra API call.

These 2 rules cover every release that has ever shipped or ever will, with zero growth. `_headers` goes back to just the fixed, non-growing set: `/*` (global security/CORS headers), `${DEV_CHANNEL_PREFIX}/*`, `/integrity.json` — 3 rules, forever.

**New file:** `scripts/ensure-cdn-cache-rules.mjs` — idempotent, run once per deploy, before `wrangler pages deploy` — the rules are zone-level rather than deployment-scoped, so ordering is not a correctness requirement, but running first means a provisioning failure aborts the deploy instead of leaving freshly published pins served without their immutable cache rule. It calls the Cloudflare API to read the current ruleset for the zone, preserves every rule it doesn't own, and PUTs its own 2 rules above only if they differ from what's already configured.

**Prerequisites not yet in place, confirm before implementing:**
- `CLOUDFLARE_API_TOKEN` needs Cache Rules / Ruleset Engine write scope, in addition to whatever Pages-deploy scope it already has — a token scoped to only "Pages: Edit" cannot manage zone-level Cache Rules.
- A `CLOUDFLARE_ZONE_ID` secret for the `maytes.co` zone needs to be added — Cache Rules are configured per-zone, and the workflow currently only has `CLOUDFLARE_ACCOUNT_ID` (an account-scoped identifier used by `wrangler pages deploy`, a different concept).
- Unlike the pin-durability finding above, this part of the design is based on Cloudflare's documented support for Ruleset Engine Cache Rules applying to Pages custom domains — it has *not* been verified against this specific zone/account (no API access available here). Confirm it works against the real `js.maytes.co` zone (e.g. in a staging pass) before relying on it in production.

### New/changed files

| File | Responsibility |
|---|---|
| `scripts/lib/semver-lite.mjs` *(new)* | Pure, dependency-free: `compareVersions(a, b)`, `latestPerMajor(versions: string[]): Map<major, version>`. Changesets only ever produces plain `X.Y.Z`, so no need for the `semver` package. |
| `scripts/lib/semver-lite.d.mts` *(new)* | Type decl for the above. |
| `scripts/lib/changelog.mjs` | Add `extractSriRecords(changelogContent): Map<version, Record<sourceName, sri>>` — parses every `## <version>` section's existing `<!-- @hash-sri-start -->` block. This is the file that already owns CHANGELOG block parsing. |
| `scripts/rehydrate-cdn-history.mjs` *(new)* | I/O shell described below. |
| `scripts/lib/cdn-config.mjs` | `majorPath` added; `buildCdnConfig(releases: Release[])` replaces `buildCdnConfig(integrity)` — now emits `_redirects` per release plus the fixed 3-rule `_headers` (no more per-release Cache-Control blocks). |
| `scripts/lib/cdn-config.d.mts` | Updated signature + new exports. |
| `scripts/cdn-config.mjs` | Reads `dist/_releases-manifest.json` (falls back to `[dist/integrity.json]` if absent, so local `npm run cdn-config` still works without `gh` auth). |
| `scripts/ensure-cdn-cache-rules.mjs` *(new)* | Idempotently provisions the 2 fixed Cache Rules via the Cloudflare API — see "Why cache-control moves to Cloudflare Cache Rules" below. |
| `.github/workflows/release.yml` | Both jobs' `actions/checkout@v4` step gains `fetch-tags: true` (see below — `fetch-depth: 0` alone does not guarantee tags are fetched). Both jobs also gain a cache step + `node scripts/rehydrate-cdn-history.mjs` between "Attach release assets" and "Deploy bundle to CDN", plus `node scripts/ensure-cdn-cache-rules.mjs` alongside the CDN deploy step. |
| `README.md` | New "Evergreen (auto-updating) URL" section (below). |
| `src/test/cdn-config.test.ts` | Existing guard test (`'keeps evergreen on the dev channel only'`) replaced — see Testing. |
| `src/test/semver-lite.test.ts`, `src/test/rehydrate-cdn-history.test.ts` *(new)* | See Testing. |

### `rehydrate-cdn-history.mjs` — sketch

```js
const pkg = readJson('package.json');
const currentIntegrity = readJson('dist/integrity.json');

const tags = execFileSync('git', ['tag', '-l', 'v*'], { encoding: 'utf8' })
  .split('\n').map(t => t.trim()).filter(Boolean)
  .filter(tag => tag !== `v${pkg.version}`); // current release already in dist/, skip re-fetching it

const sriRecords = extractSriRecords(readFileSync('CHANGELOG.md', 'utf8')); // one read, HEAD, covers every version ever backfilled

const releases = [currentIntegrity];

for (const tag of tags) {
  const version = tag.slice(1);
  const cacheDir = `.cdn-history-cache/${tag}`;

  if (!existsSync(`${cacheDir}/integrity.json`)) {
    execFileSync('gh', ['release', 'download', tag,
      '--pattern', 'integrity.json', '--pattern', 'checkout-button.*',
      '--dir', cacheDir, '--clobber']);
  }

  const integrity = readJson(`${cacheDir}/integrity.json`);

  for (const [sourceName, meta] of Object.entries(integrity.files)) {
    const bytes = readFileSync(`${cacheDir}/${meta.hashedName}`);
    const recomputed = `sha384-${createHash('sha384').update(bytes).digest('base64')}`;
    // Prefer the CHANGELOG's recorded SRI (git history, harder to tamper with than
    // a release asset store) over integrity.json's own self-reported value; fall
    // back to self-reported only for the rare tag with no CHANGELOG SRI block.
    const reference = sriRecords.get(version)?.[sourceName] ?? meta.sri;
    if (recomputed !== reference) {
      console.error(`[rehydrate-cdn-history] MISMATCH ${tag} ${sourceName}: got ${recomputed}, expected ${reference}`);
      process.exit(1); // fail the deploy, don't ship or silently drop it
    }
    copyFileSync(`${cacheDir}/${meta.hashedName}`, `dist/${meta.hashedName}`);
    if (existsSync(`${cacheDir}/${meta.hashedName}.map`)) {
      copyFileSync(`${cacheDir}/${meta.hashedName}.map`, `dist/${meta.hashedName}.map`);
    }
  }
  releases.push(integrity);
}

writeFileSync('dist/_releases-manifest.json', JSON.stringify(releases, null, 2));
```

**Why CHANGELOG.md at HEAD, not `git show <tag>:CHANGELOG.md`:** verified empirically — `1.0.0`'s own tag commit predates the SRI-block feature and has no block, but the block was *backfilled* into a later commit (present at `v1.0.1`'s CHANGELOG.md). Reading the file at HEAD picks up backfills; reading per-tag would miss them. Cross-checked: the backfilled 1.0.0 block's SRI (`sha384-dZQS1K...`) matches the `sri` field in `v1.0.0`'s own uploaded `integrity.json` byte-for-byte — confirms the backfill is trustworthy and the two sources agree.

**Why cache historical downloads (`actions/cache`, key `cdn-history-${{ github.run_id }}`, `restore-keys: cdn-history-`):** without it, CI cost grows O(number of releases ever) on every single deploy. With the incrementally-restored cache pattern, each deploy only downloads tags it hasn't seen before — O(1) marginal cost per release.

**`fetch-tags: true` is required, not optional:** `actions/checkout@v4`'s `fetch-depth: 0` fetches full commit history, but tag fetching is governed by a separate `fetch-tags` input that defaults to `false` — the two are independent settings, and the current `release.yml` only sets the former. Without `fetch-tags: true` explicitly added, `git tag -l 'v*'` could silently return nothing, and the script would have no error to raise — it would just find zero historical releases and quietly reproduce today's bug instead of fixing it. Add `fetch-tags: true` alongside `fetch-depth: 0` on both jobs' checkout step.

**Defend against that failure mode anyway, don't just rely on the config being right:** before doing any downloading, `rehydrate-cdn-history.mjs` should cross-check the number of tags found against the number of `## <version>` sections in `CHANGELOG.md` (already being read for `extractSriRecords`). If `CHANGELOG.md` records 2+ prior versions but `git tag -l 'v*'` found none (or noticeably fewer tags than CHANGELOG sections), abort non-zero with a clear message rather than silently proceeding with partial history — this catches a future regression (someone changes the checkout step, a GitHub Actions behavior change, a runner misconfiguration) the same way the deploy-time hash check catches a corrupted asset.

**Error handling:** any hash mismatch, tag/CHANGELOG count mismatch, or `gh` failure exits non-zero *before* `wrangler pages deploy` runs. Cloudflare Pages then simply keeps serving the last successful deployment — stale-but-consistent, which is safe. A partial or silently-wrong deploy is not.

### `buildCdnConfig(releases)` — new contract

```ts
type Release = { version: string; files: Record<string, { hashedName: string; sri: string; /* ... */ }> };
function buildCdnConfig(releases: Release[]): { headers: string; redirects: string };
```

`redirects`: for every `release` in `releases`, emit the existing `/v{release.version}/{sourceName} → /{hashedName}` 200-rewrites (unchanged logic, now looped instead of singular). Additionally, `latestPerMajor(releases.map(r => r.version))` groups by major and picks the numerically-highest version per group; for each `(major, version)` pair, emit `/v{major}/{sourceName} → /{hashedName}`.

`headers`: **no longer varies with `releases.length`** — just the fixed `/*`, `${DEV_CHANNEL_PREFIX}/*`, `/integrity.json` blocks (unchanged from today). Cache-Control for every immutable and evergreen path now comes from the 2 Cache Rules in `scripts/ensure-cdn-cache-rules.mjs`, not from anything `buildCdnConfig` writes.

`/dev/*` itself is otherwise unchanged: it's still derived solely from `releases[0]` (the current build) — historical releases never touch it.

## CSP guidance (README)

This bundle has no `eval`/`Function`/string-timer usage (enforced today by `scripts/csp-check.mjs`) and does its checkout hop via `window.open('about:blank', …)` + `window.location.href` — not `fetch`/XHR, not an iframe. So the only CSP directive that matters for either integration path is `script-src`; no `connect-src`/`frame-src` addition is needed for the popup/redirect target.

```
Content-Security-Policy: script-src 'self' https://js.maytes.co;
```

## README addition

Insert as a new `###` subsection in `## Install`, immediately after the existing "Script tag (CDN)" content (after the current "Use a pinned URL in every environment..." line, before `### npm`):

```markdown
### Evergreen (auto-updating) URL

Pinning (above) is the default and the recommended choice for production. If you'd rather trade that guarantee for automatic updates — accepting that a bad release reaches you immediately, with no ability to stay on a known-good build — use the major-version alias instead:

​```html
<script src="https://js.maytes.co/v1/checkout-button.js"
        crossorigin="anonymous"></script>
​```

This URL has no `integrity` attribute, and can't have one: it moves to whichever `1.x` release is newest (~5 minute edge cache), so the bytes behind it change without notice. Restrict which origins your page trusts via CSP instead of a content hash:

​```
Content-Security-Policy: script-src 'self' https://js.maytes.co;
​```

This isn't a way to get bug fixes faster than pinning — a fix ships the same way either way (a new release), and if you're pinned, bumping your pin to the new version is exactly as fast as staying on `/v1/` would have been. What you're actually trading is safety: on `/v1/`, a bad release reaches you the moment it ships, with no way to stay back on the last good build. `https://js.maytes.co/integrity.json` always reflects whatever `/v1/` currently serves, if you want to poll it and alert on unexpected changes yourself.

`/v1/` only ever tracks `1.x`. When a breaking `2.0.0` ships, `/v1/` keeps resolving to the last `1.x` release rather than disappearing or jumping to `2.x` — move to `/v2/checkout-button.js` explicitly when you're ready.
```

## Testing

- `src/test/semver-lite.test.ts` *(new)*: `compareVersions` ordering incl. double-digit segments (`1.9.0` < `1.10.0`); `latestPerMajor` on a mixed list of majors.
- `scripts/lib/changelog.mjs` tests: `extractSriRecords` against a synthetic multi-version CHANGELOG fixture, including a version with no SRI block (should be absent from the returned map, not throw).
- `src/test/cdn-config.test.ts`: replace `'keeps evergreen on the dev channel only'` with cases asserting, on a synthetic multi-release array: (a) `redirects` contains a rewrite for every release's SemVer path plus one `/v{major}/...` rewrite per major pointing at the highest version in that major, and (b) `headers` stays exactly the fixed 3-block set regardless of how many releases are in the array (a regression test for the ceiling bug — assert its size doesn't grow with `releases.length`). Add a code comment referencing `docs/cdn-versioning.md`'s "Revisited" section so this isn't silently reverted again without someone reading why it changed.
- `rehydrate-cdn-history.mjs`'s hash-mismatch failure path, and the tag-count-vs-CHANGELOG-count sanity check: unit-test the pure comparison/validation logic (extract both as small testable functions rather than inlining in the top-level script body) rather than the `gh`/`git` shell-out, which isn't worth mocking.
- `ensure-cdn-cache-rules.mjs`: unit-test the pure "does the current ruleset already match the desired 2 rules" diff logic (extracted, not inlined) against fixtures for "matches, no-op" and "differs, needs PUT" — mock the Cloudflare API call itself rather than hitting it in tests.

## Non-goals

- No pruning of old releases from `dist`/the manifest/`_redirects` (bundle sizes are tiny and `_redirects`' 2,000-static-redirect budget supports ~600+ releases at 3 rows each; revisit only if this ever grows that large). `_headers` no longer has a release-count-dependent ceiling at all, now that Cache-Control lives in the 2 fixed Cache Rules instead.
- No public/documented `releases.json` API — `dist/_releases-manifest.json` is a build-time intermediate. It will incidentally be servable at the CDN root since nothing excludes it (harmless: same class of already-public data as `integrity.json`), but it isn't a promised interface.
- No automated hash-diff alerting service — the README just tells merchants they *can* poll `integrity.json` themselves.
- No change to `/dev/` behavior.
- No retroactive fix for merchants already pinned to a buggy release — that's a release-process/communication problem, not a CDN problem (see `cdn-versioning.md`, "Revisited").
- No guard against manually running the `cdn-deploy` workflow against an untagged/dirty ref. Today, such a build's `/v{version}/` pin gets silently overwritten by the next real release anyway (the bug this spec fixes); after this change, it would instead persist forever as if it were a real release. `cdn-deploy` is already documented as a backfill tool for an already-tagged version, so this should be an operational discipline note (don't run it against arbitrary branches), not a new code guard — flag it in the workflow's own comments if it recurs as a real mistake.
