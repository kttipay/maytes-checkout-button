# `@maytes/checkout-button` — Technical Overview

> For the merchant-facing integration guide, see [`INTEGRATION.md`](https://github.com/kttipay/checkout-web/blob/develop/INTEGRATION.md) at the repo root. This document covers internals.

## Purpose

A small TypeScript library that merchants drop onto their checkout page. `Maytes(...)` is a callable factory (Stripe-style) — each call returns an isolated SDK instance:

- `createCheckout` — a closure the merchant supplies that mints a Maytes checkout on their backend; the button awaits it on click.
- `renderButton(container, options?)` — render a "Split with Maytes" pill into the page; on click it invokes the closure and navigates to the Maytes-hosted checkout. Default mode opens a centered popup on desktop and auto-falls back to redirect on mobile or when blocked; `mode: 'redirect'` opts into a same-window redirect always. Inside an iframe every redirect targets the top-level window.

The merchant's page never embeds the Maytes flow — it opens the hosted checkout and reads authoritative state back via the merchant's `return_url` / `cancel_url` and via webhooks.

## Distribution

Three bundle formats ship from `dist/`:

| Bundle | Format | Purpose |
|---|---|---|
| `checkout-button.js` | IIFE | `<script>` drop-in, attaches `window.Maytes` |
| `checkout-button.mjs` | ESM | `import { Maytes } from '@maytes/checkout-button'` in modern bundlers |
| `checkout-button.cjs` | CJS | `require('@maytes/checkout-button')` for legacy Node/CJS builds |

The IIFE (CDN) bundle ships minified with a sourcemap; the ESM/CJS (npm) bundles ship unminified so the consumer's bundler can minify them.

Each release is served from `https://js.maytes.co` under four URL forms:

| Form | Example | Cache | SRI |
|---|---|---|---|
| SemVer pin | `/v<version>/checkout-button.js` | 1 yr | yes |
| Content-hash pin | `/checkout-button.<8-char-sha256>.js` | 1 yr | yes |
| Internal dev branch | `/dev/checkout-button.js` | no cache | no (bytes roll) |
| Evergreen major (opt-in) | `/v<major>/checkout-button.js` | ~5 min | no (bytes roll) |

Pin a SemVer or hashed URL for production and set `<script integrity="…">` for tamper protection; `/dev/` is internal-only, for pre-merge testing (see below). An opt-in `/v1/`-style evergreen major channel also exists for merchants who explicitly choose auto-updates over the pin-safety guarantee — see [`cdn-versioning.md`](./cdn-versioning.md) for the reasoning. `integrity.json` at the CDN root lists the version, hash, and SRI for every bundle; hashing, SRI generation, and CSP linting all run in `npm run build`.

CDN plumbing: Cloudflare Pages project `checkout-button` (Maytes account). The release workflow deploys `dist/` via `wrangler pages deploy`. `scripts/cdn-config.mjs` emits `_headers` — the fixed global/security headers plus CORS and `/integrity.json` — and `_redirects`, which rewrites every release's SemVer and evergreen paths onto its hashed bundle. `Cache-Control` for the pins and the evergreen alias comes from Cloudflare Cache Rules, provisioned by `scripts/ensure-cdn-cache-rules.mjs`, not from `_headers`.

**Internal dev channel:** pushing to the `dev` branch runs `.github/workflows/dev.yml` — the same typecheck/test/build gate as a PR, then `wrangler pages deploy --branch=dev`. That's a Cloudflare Pages *preview* deployment, entirely separate from the production deployment that serves `js.maytes.co` — a broken `dev` push cannot affect production. A Cloudflare zone-level Redirect Rule (`scripts/ensure-cdn-dev-redirect.mjs`, re-applied on every `dev` push) forwards `js.maytes.co/dev/*` to `dev.checkout-button.pages.dev` — Cloudflare's stable alias for that branch's latest preview — with an explicit cache-bypass Cache Rule on the same path so the redirect itself is never cached; the destination already serves `max-age=0, must-revalidate`, so nothing along the path can go stale.

## Public API

```ts
type MaytesEnvironment = 'sandbox' | 'production';

interface CreateCheckoutResult { checkoutId: string; checkoutUrl?: string }
type CreateCheckoutFn = () => Promise<CreateCheckoutResult>;

interface MaytesOptions {
  createCheckout: CreateCheckoutFn;
  environment: MaytesEnvironment;
}

interface MaytesInternalOptions {  // second positional arg — hidden from merchant autocomplete
  baseUrl?: string;   // dev env / regional override
  cspNonce?: string;  // forwarded to injected <style> tags
}

type RenderButtonMode = 'redirect' | 'popup';

interface RenderButtonOptions {
  label?: string;   // default: 'Split with'
  block?: boolean;  // default: false (inline pill); true for full-width
  mode?: RenderButtonMode;  // default: 'popup' — opens a centered window (auto-falls back to redirect on mobile or when blocked); 'redirect' opts into same-window navigation always (inside an iframe every redirect targets the top-level window)
}

// Factory — each call returns an isolated instance:
const maytes = Maytes(options: MaytesOptions, internal?: MaytesInternalOptions): MaytesSDK;

interface MaytesSDK {
  renderButton(container: HTMLElement, options?: RenderButtonOptions): () => void;
  redirectToCheckout(options: { checkoutId: string; replace?: boolean }): void;
  checkoutUrl(options: { checkoutId: string }): string;
  destroy(): void;
}
```

`window.Maytes(opts)` reads like `window.Stripe(key)`. The IIFE build attaches the factory as `window.Maytes`; the ESM/CJS builds export `{ Maytes }`.

`redirectToCheckout` / `checkoutUrl` are the headless path for power users and internal tooling (no button). `destroy()` tears down the instance — popup poll, any open popup, overlay, buttons, and listeners — in one shot and is idempotent; React cleanup is just `() => maytes.destroy()`.

`MaytesError.code` is exactly `'CONFIG'` — the only error code the SDK raises.

## End-to-end flow

```mermaid
sequenceDiagram
  autonumber
  actor Shopper
  participant Page as Merchant page
  participant Button as Maytes button
  participant Overlay as Overlay <dialog>
  participant MerchantBE as Merchant backend
  participant Popup as Maytes checkout popup
  participant API as Maytes API

  Note over Page,Button: Merchant created an instance — Maytes({ createCheckout, environment })<br/>— and called maytes.renderButton(slot)

  Shopper->>Button: Clicks "Split with Maytes"
  Button->>Button: aria-disabled = true, spinner shown
  Button->>MerchantBE: createCheckout() (merchant-owned closure)
  MerchantBE->>API: POST /api/merchant/v1/checkouts
  API-->>MerchantBE: { checkout_uuid }
  MerchantBE-->>Button: { checkoutId }

  alt default mode (popup) on desktop
    Button->>Popup: window.open("about:blank", "maytes-checkout-*", 500x800)
    Button->>Popup: Paint branded loading screen
    Button->>Overlay: showModal() — dark backdrop, Maytes logo, "Completing checkout…"
    Button->>Page: dispatchEvent("maytes:checkout-opened")
    Button->>Popup: popup.location.replace(hosted checkout URL)
    Note over Button,Popup: Button polls popup.closed every 500ms

    Shopper->>Popup: Shares with mates, allocates, pays
    Popup->>API: GET / POST checkout endpoints
    API-->>Popup: Order state
    Popup-->>Shopper: Redirects popup to merchant return_url / cancel_url
    Shopper->>Popup: Closes popup (or return_url page calls window.close())

    Note over Button: Next poll detects popup.closed === true
    Button->>Overlay: close() + remove from DOM
    Button->>Button: aria-disabled removed
    Button->>Page: dispatchEvent("maytes:checkout-closed")
  else mode: "redirect", phone, or blocked popup
    Button->>Page: top-level navigation (window.top when framed, else the current window)
    Button->>Page: dispatchEvent("maytes:checkout-redirected", { url, target })
    Note over Page: Hosted checkout loads in the top-level window.<br/>If the top window refuses, a new tab opens (target "tab");<br/>if that is refused too, "maytes:checkout-failed" (navigation-blocked).
  end

  Note over Page: Merchant's return_url page (server-rendered) is authoritative.<br/>Webhooks are source of truth.
```

The merchant page never receives a structured callback for completion — they observe `maytes:checkout-opened`, `maytes:checkout-closed`, `maytes:checkout-redirected`, and `maytes:checkout-failed` `CustomEvent`s on `document` for UI state, and use their own `return_url` / `cancel_url` + webhooks as the authoritative outcome channel. The `failed` event carries `event.detail.reason` of `'create-checkout-rejected'` | `'invalid-shape'` | `'navigation-blocked'` plus `event.detail.cause` where available. The `redirected` event carries `event.detail.url` and `event.detail.target` (`'self' | 'top' | 'tab'`), dispatched synchronously after the navigation has been requested and before the page unloads. When the target is `'tab'`, no popup poll starts and no `maytes:checkout-opened` / `maytes:checkout-closed` pair fires — the merchant observes only `maytes:checkout-redirected` with `target: 'tab'`.

In the default `mode: 'popup'`, the button opens a blank popup synchronously on click (so the browser attributes it to the user gesture), paints a branded Maytes loading screen into it, then `popup.location.replace(url)`s to the hosted checkout once `createCheckout` resolves. On phones (top-level viewport up to 600px) the popup model behaves as a redirect. If the popup is blocked (or `mode: 'redirect'` is set explicitly), the button navigates the top-level window: its own window when not framed, `window.top` when framed, a new tab when the top window refuses — and dispatches `maytes:checkout-redirected` — this is a normal outcome, not a failure.

## Environment resolution

```
sandbox    → https://sandbox-checkout.maytes.co
production → https://checkout.maytes.co
```

(Lives in `src/env.ts`.) The exported `MaytesEnvironment` type is exactly `'sandbox' | 'production'` — that's the full public surface.

## Behaviour contracts

| Condition | Behaviour |
|---|---|
| `Maytes(options)` where `options` isn't an object | `MaytesError(CONFIG)` |
| `createCheckout` isn't a function | `MaytesError(CONFIG)` |
| `environment` isn't `'sandbox' \| 'production'` | `MaytesError(CONFIG)` |
| `renderButton(container)` where container isn't an `HTMLElement` | `MaytesError(CONFIG)` |
| `renderButton()` on a destroyed instance | `MaytesError(CONFIG)` |
| `mode` not `'redirect' \| 'popup'` | `MaytesError(CONFIG)` |
| Click while this instance's `createCheckout` is in flight | No-op. A per-instance busy flag gates the instance's buttons. |
| `createCheckout` rejects | Button re-enables, overlay clears, `console.error`, `maytes:checkout-failed` (reason `create-checkout-rejected`). |
| `createCheckout` resolves the wrong shape | Same as rejection, reason `invalid-shape`. |
| Default mode (`popup`) on a wide viewport | Blank popup opened synchronously, branded loader painted, then `popup.location.replace(url)`; `maytes:checkout-opened`. The width is the top window's (or the screen's when the top is cross-origin), never the iframe's. |
| Default mode (`popup`) on a phone | Behaves as `redirect`. |
| `mode: 'redirect'`, or blocked popup | Top-level navigation to the hosted checkout; `maytes:checkout-redirected` (`detail.url`, `detail.target`). No `failed` event. |
| Framed, top window refuses the navigation | New tab with `opener` severed; `maytes:checkout-redirected` (`target: 'tab'`). |
| Framed, top window and new tab both refused | Button re-enables, `console.error`, `maytes:checkout-failed` (reason `navigation-blocked`, `cause` = the refusal). |
| Cleanup fn or `destroy()` called twice | Idempotent — no-op. |
| Last button removed | Injected `<style>` tag is removed (refcounted in `styles.ts`). |

We deliberately don't expose `onComplete` / `onCancel` / `onError` / `onBlocked` callbacks. In the default popup mode, the hosted checkout owns terminal flow and merchant-return navigation; in redirect mode the merchant page is gone before the checkout terminates. Failures before navigation (network errors in `createCheckout`, invalid shape) are surfaced via `console.error` + the `maytes:checkout-failed` event.

## Security

- The `checkoutId` is the per-session secret — same model as Stripe Checkout session URLs. Treat it like a magic link. The button URL-encodes it before constructing the redirect.
- `redirectToCheckout` rejects non-http(s) protocols on the override `baseUrl` (`MaytesError(CONFIG)`) so a poisoned config can't navigate the page to `javascript:` / `data:` / `vbscript:`.
- All SVG is built via `document.createElementNS` — no `innerHTML` anywhere. `csp-check.mjs` fails the build if the bundled output contains dynamic-code-eval primitives.
- When `cspNonce` is provided (second positional arg), it's set as the `nonce` attribute on the injected `<style>` tag — merchants on strict-style CSPs can keep the policy intact without `'unsafe-inline'`.

## Internal architecture

```
src/
├── index.ts        # public re-exports; attaches window.Maytes (IIFE only)
├── maytes.ts       # Maytes() factory — option validation, builds the MaytesSDK instance
├── state.ts        # createInstanceState — per-instance state (config, busy, popup, overlay, buttons)
├── button.ts       # renderButton() — DOM building, click handler, popup launch, busy gate
├── redirect.ts     # checkoutUrl + redirectToCheckout (URL build + nav)
├── framing.ts      # isFramed / sameOriginTop / viewportWidth / navigateTopLevel (leave an embedding iframe)
├── env.ts          # isValidEnvironment, resolveBaseUrl (env → URL)
├── styles.ts       # ensureStylesInjected / releaseStyles (refcounted)
├── overlay.ts      # full-screen <dialog> with Maytes logo + spinner; mounts in the same-origin top document when framed
├── branding.ts     # Maytes logo SVG + brand colors
├── types.ts        # public type surface + global Window augmentation
├── errors.ts       # MaytesError + MaytesErrorCode
├── version.ts      # SDK_VERSION literal (generated from package.json)
└── test/           # vitest suite
```

State is **per-instance** (`createInstanceState`) — there is no module-level singleton, so the SDK is SSR-safe, supports multiple isolated instances on one page (multi-tenancy), and each test runs against a fresh instance. The click busy-gate is per-instance: two buttons rendered from the same instance share one in-flight checkout; separate instances are independent.

## Build hygiene

- **`scripts/csp-check.mjs`** — post-build linter that fails the build if it finds dynamic-code-eval primitives in the bundled output. Result: bundle is CSP-friendly (`script-src 'self'` works with no `'unsafe-eval'`).
- **`scripts/hash-and-sri.mjs`** — runs after `tsup`, writes `dist/integrity.json`, copies bundles to hashed filenames, and rewrites the SRI block in `CHANGELOG.md` for the current `package.json` version. The CHANGELOG injection runs only when `changeset version` has already created a `## <version>` section for the current version, so ordinary builds never invent a changelog entry. SRI tables are machine-generated.
- **No `innerHTML`** — SVG built via `document.createElementNS`.

## Testing

### Unit tests

```bash
cd checkout-button
npm test              # vitest in watch mode
npm run test:run      # single-shot, used by CI
npm run typecheck     # tsc --noEmit
```

Coverage — **249 tests across 18 files** (`src/test/`):

| File | Tests | What it covers |
|---|---|---|
| `init.test.ts` | 10 | factory validation (`createCheckout` type, `environment` enum), internal `baseUrl` passthrough |
| `button.test.ts` | 74 | render → click → closure → default popup launch (`about:blank` sync open, branded loader, `location.replace` navigation), explicit redirect mode, phone redirect fallback, blocked-popup redirect event, unique per-instance window name, busy gating, double-click suppression, destroy-mid-flight guard, listener detach on destroy, versioned style marker, immediate overlay clear on Escape, rejection / invalid-shape recovery, env → URL mapping, `baseUrl` override, popup-closed polling + overlay teardown, `maytes:checkout-*` events, cleanup/`destroy` idempotency, style refcounting, `cspNonce` presence/absence, `label` / `block` / `mode` props, multi-button concurrency, framed navigation (same-origin top window on a phone, popup sizing from the top window, cross-origin top window allowing navigation, a refused top navigation opening a new tab, both refused failing loudly and re-enabling the button), repeated button clicks without icon swap |
| `framing.test.ts` | 10 | `isFramed` / `sameOriginTop` / `viewportWidth` at top level and when framed, falling back to the screen width when the top window is cross-origin (and to the local width when the screen width is unknown), `navigateTopLevel` targeting the top window, opening a tab with `opener` severed when the top window refuses, reporting the refusal when both are blocked, rethrowing failures that aren't a `SecurityError`, recognising a `SecurityError` thrown from another realm as a top-window refusal or as a cross-origin top window |
| `env.test.ts` | 24 | `isValidEnvironment` (positive, negative and non-string values via `it.each`, type-guard narrowing), `resolveBaseUrl` (sandbox / staging / production mapping, override precedence, empty-string override, defence-in-depth throw on unknown env) |
| `state.test.ts` | 7 | popup-name generation (`crypto.randomUUID` + fallback), `createInstanceState` config passthrough and defaults |
| `redirect.test.ts` | 20 | URL construction, trailing-slash strip, URL encoding, empty / whitespace `checkoutId`, `replace` vs `href` navigation, and framed navigation: a same-origin top window honouring `replace`, throwing `MaytesError` when a cross-origin top window and a new tab are both refused |
| `overlay.test.ts` | 13 | `hideOverlay` no-op when nothing was shown, mounting into the local document at top level, mounting into a same-origin top document when framed (with its style tag cloned along), falling back to the local document when the top window throws `SecurityError` |
| `styles.test.ts` | 5 | direct `ensureStylesInjected`/`releaseStyles` ref-counting (no button/DOM involved) |
| `branding.test.ts` | 4 | `buildMaytesLogo` SVG contract (viewBox, sizing, path structure) |
| `errors.test.ts` | 8 | `MaytesError` is an `Error`, code/message/name/stack present, `toString` serialization, `MaytesErrorCode.Config === 'CONFIG'`, code surface is `{ Config }` only |
| `changelog.test.ts` | 14 | unit-tests the release-script changelog slicer (`scripts/lib/changelog.mjs`), not SDK behaviour: section-bounds lookup, section extraction, SRI block injection (including the never-invent-a-section guard and idempotent re-runs), SRI record extraction across every released version |
| `cdn-config.test.ts` | 8 | unit-tests `scripts/lib/cdn-config.mjs`: SemVer and `/v{major}` path building, hashed URL building, leading-slash normalization, a pinned SemVer redirect for every tracked release, one evergreen redirect per major, and a fixed header set |
| `cdn-cache-rules.test.ts` | 24 | unit-tests `scripts/lib/cdn-cache-rules.mjs`: the three fixed Cloudflare Cache Rules scoped to `js.maytes.co` (immutable pins, evergreen, dev-branch bypass), wildcard disambiguation between pinned SemVer, content-hash and evergreen paths, the unhashed-bundle exclusion, and `rulesetNeedsUpdate` change detection |
| `cdn-dev-redirect.test.ts` | 8 | unit-tests `scripts/lib/cdn-dev-redirect.mjs`: the `/dev/*` → Pages-preview redirect rule's scope, target expression, and status code, and `redirectNeedsUpdate` change detection |
| `release-verification.test.ts` | 7 | unit-tests the CDN history rehydration checks: `verifyReleaseHash` against the CHANGELOG record with an `integrity.json` fallback, `checkTagCoverage` for new repos, the version threshold and missing tags |
| `semver-lite.test.ts` | 6 | unit-tests `compareVersions` (numeric major/minor/patch ordering) and `latestPerMajor` (highest version per major, order-independent) |
| `readme.test.ts` | 5 | unit-tests `scripts/lib/readme.mjs`'s CDN-example injector: no-op when the markers are absent, replaces both example URLs, leaves the surrounding prose untouched, idempotent re-run, keeps the SRI placeholder as a literal ellipsis |
| `foundation.test.ts` | 2 | vendored brand tokens (`src/foundation/brand.generated.ts`) match `foundation.lock.json`'s tag, every role the button uses is an opaque hex colour |

Run `npm run test:coverage` for a coverage report (thresholds: 90% lines/statements/functions, 85% branches — enforced in both `pr.yml` and `release.yml`).

### End-to-end testing

Manual end-to-end verification against a real (sandbox) checkout requires a merchant backend that can mint one via the Maytes API — see [`create-checkout`](https://staging-developers.maytes.co/create-checkout) in the merchant docs. This repo's own unit tests (above) cover the button's behaviour in isolation with a stubbed `createCheckout`.

### CSP / integrity verification

```bash
cd checkout-button
npm run build                  # rebuilds bundles + csp-check + hash-and-sri
cat dist/integrity.json        # SRI hashes for each bundle
```

Sanity-check the SRI tag in a merchant page:

```html
<script src="https://js.maytes.co/checkout-button.<hash>.js"
        integrity="sha384-<digest from integrity.json>"
        crossorigin="anonymous"></script>
```

Browser will block load if the bundle hash drifts.

## The redirect destination

The Maytes-hosted checkout the button navigates to is a separate, backend-owned application — not part of this repo. It's bootstrapped purely from the `?id=<uuid>` URL param (no `postMessage` handshake), and at terminal status redirects the shopper to the merchant's `return_url` / `cancel_url` as described in [What happens on click](#3-what-happens-on-click) above.

## Mobile app deep links

The button hands off only to the merchant's `return_url` / `cancel_url` — it never links to the Maytes app directly. Separately, the **paylinks** app (`app.maytes.co`, `staging-app.maytes.co`) serves `/.well-known/apple-app-site-association` + `/.well-known/assetlinks.json` (from `apps/maytespaylinks/src/jsMain/resources/public/.well-known/`), so the payment links shoppers share with mates open in the Maytes app on installed devices via iOS Universal Links / Android App Links, falling back to the browser otherwise. Nothing in this SDK configures or depends on that; it is noted here only because the end-to-end "split with mates" flow terminates on those links.

## Deferred / known follow-ups

- **CDN: live.** Cloudflare Pages project `checkout-button` is deployed at `https://js.maytes.co` (release workflow + `scripts/cdn-config.mjs`). `/dev/<bundle>` aliases the unhashed names for development auto-updates; `/v<version>/<bundle>` aliases each release's hashed bundle; hashed filenames are immutable. Every historical release's pins now persist across later releases — before this, shipping a new release 404'd the previous ones — and `/v<major>/<bundle>` serves the newest release in that major as an opt-in evergreen alias.
- **`onComplete` request.** If we ever need an in-page completion signal for analytics, the right design is `BroadcastChannel` between the checkout tab and the merchant tab — *not* re-adding callbacks (they'd be unreachable in the canonical same-tab flow).
