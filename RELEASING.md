# checkout-button SDK — Release Pipeline & CI/CD

> Status: **publishing armed**. A `major` changeset is queued, so the next merge of the
> auto-created "Version Packages" PR cuts `1.0.0` and publishes to npm with provenance.

## This repo is the source

`@maytes/checkout-button` used to live inside the private `kttipay/checkout-web` monorepo,
mirrored here only after each release. It's the real source now — see
[`docs/npm-provenance.md`](docs/npm-provenance.md) for why. It has zero build coupling to
anything else; publish to **npm** for types/dev use, distribute at runtime as a
**CDN `<script>` with SRI**.

## What's here

| Area | File(s) | Purpose |
|---|---|---|
| PR CI | `.github/workflows/pr.yml` | On every PR: typecheck, vitest, build (tsup + SRI + CSP scan), production-only `npm audit`, and a **changeset-presence gate** (skipped on the bot's own `changeset-release/main` branch, which by construction never adds one). |
| Release CI | `.github/workflows/release.yml` | On push to `main`: Changesets opens a "Version Packages" PR; merging it publishes to npm (with provenance), deploys the bundle to the CDN, and cuts a GitHub Release directly on this repo. |
| Versioning | `.changeset/` (`config.json`, `README.md`) | [Changesets](https://github.com/changesets/changesets) in single-package mode with the GitHub changelog formatter (`@changesets/changelog-github`, repo `kttipay/checkout-button`). |
| Version source of truth | `scripts/gen-version.mjs` + `prebuild` script | `src/version.ts` is **generated from `package.json`** so the version can't drift across the two files. |
| CDN config | `scripts/cdn-config.mjs` | Emits `_headers`/`_redirects` (Cloudflare Pages + Netlify compatible): exact-path immutable cache for each SemVer/hash bundle pin (read from `integrity.json`), short cache for the `/dev/*` rolling alias, CORS, SRI-friendly. |
| Package metadata | `package.json` | `publishConfig` (public + provenance), `repository`/`homepage`/`bugs`/`keywords`, `sideEffects`, Changesets scripts. |
| npm landing | `README.md` | Install (CDN + npm), usage, API table. |

## Versioning & changelog

- **SemVer** + **Keep a Changelog**, managed by **Changesets**.
- The published package starts at **`1.0.0`**. Nothing was ever published to npm before, so the public version history begins fresh at 1.0.0 rather than 0.x; any earlier internal version numbers were dropped from `CHANGELOG.md` (that history remains in the old monorepo's git log).
- Each PR that changes the SDK must add a changeset (`npm run changeset`) — enforced by the PR `changeset` job. Use `--empty` for changes that don't need a release.
- On release, Changesets bumps `package.json`, regenerates `src/version.ts`, and writes the `CHANGELOG.md` entry. The build then injects **SRI hashes** into that same changelog section.

### CHANGELOG injection is gated on the release, not on `private`

`hash-and-sri.mjs` writes `dist/integrity.json` on every build, but only touches `CHANGELOG.md` when a `## <version>` section for the current version **already exists** — which is true exactly when `changeset version` has just created it (the release script is `changeset version && npm run build`). Ordinary local/CI builds skip the CHANGELOG write entirely rather than inventing a spurious entry. The decision lives in `injectSriBlock` (`scripts/lib/changelog.mjs`), which returns `null` for "not a release build" and is covered by `src/test/changelog.test.ts`.

## Brand colours come from the design foundation

The SDK's Maytes colours are vendored, not authored here. `foundation.lock.json` pins the source:

| Field | Meaning |
|---|---|
| `repo` | `kttipay/designsystem` — the design source of truth |
| `tag` | the designsystem release the values were copied from (currently `v0.3.0`) |
| `source` | `web/tokens.ts`, the generator's TypeScript output |

`scripts/sync-foundation-tokens.mjs` fetches that file at the pinned tag (`gh api repos/<repo>/contents/<source>?ref=<tag>`, or a local `--from <path>`), transpiles and imports it with the already-installed TypeScript devDependency, picks the roles the button needs, and writes:

- `src/foundation/brand.generated.ts` — `foundation.brand.primary` / `.secondary`, `foundation.palette.burgundy[700]` (hover), `foundation.palette.base.white`, `foundation.text.primaryInverse`, plus `FOUNDATION_TAG`;
- `foundation.lock.json` — rewritten with the tag you passed.

**Refreshing:** `npm run sync:foundation -- --tag vX.Y.Z`, then run `npm run typecheck && npm run test:run` and commit the generated file with the lock file. Any hex change is a visible SDK change, so add a `patch` changeset. `src/test/foundation.test.ts` asserts the generated header's tag equals the lock file's tag — editing the generated file by hand fails CI.

**Why vendoring:** the designsystem repo's `web/package.json` is `0.1.0`, `private`, `UNLICENSED` — there is no npm publish route today, and a GitHub Packages scope (`@kttipay`) would add registry auth to a public drop-in script's build. Vendoring a five-value subset by script keeps provenance (the tag) without that friction.

**Future upgrade path:** once `kttipay/designsystem` publishes `@kttipay/foundation` (GitHub Packages npm), import `brand`/`palette`/`text` from it, delete `scripts/sync-foundation-tokens.mjs`, `foundation.lock.json` and the generated file, and keep the drift test's intent by pinning the dependency to an exact version.

## Merchant integration & environments

Merchant-facing integration lives in [`README.md`](README.md) (script tag / npm, usage, API table) and the [full integration guide](https://staging-developers.maytes.co/checkout-button). Sandbox vs production is a **runtime `environment` flag** on the same bundle, not a separate build; the SDK CDN (`js.maytes.co`) is one host with pin-vs-roll — prod pins immutable SemVer or hashed URLs + SRI, staging/dev tracks the rolling `/dev` alias.

## Verification performed

- `typecheck`, `build` (tsup + SRI + CSP), and vitest pass.
- Production-only `npm audit` → **0 vulnerabilities** (dev-tree advisories don't ship to merchants).
- CHANGELOG merge logic unit-tested in isolation: single header, SRI injected into the right section, historical entries preserved.
