# `@maytes/checkout-button` — Technical Overview

> Integrating the button? Start with the per-stack quickstarts in [`README.md`](../README.md#choose-your-setup) and the [integration guide](https://developers.maytes.co/checkout-button). This document covers internals: distribution, the end-to-end sequence, behaviour contracts and tests.

## Purpose

A small TypeScript library that merchants drop onto their checkout page. `Maytes(...)` is a callable factory (Stripe-style) — each call returns an isolated SDK instance:

- `createCheckout` — a closure the merchant supplies that mints a Maytes checkout on their backend; the button awaits it on click.
- `renderButton(container, options?)` — render a "Split with Maytes" pill into the page; on click it invokes the closure and navigates to the Maytes-hosted checkout. Default mode opens a centered popup on desktop and auto-falls back to redirect on mobile or when blocked; `mode: 'redirect'` opts into a same-window redirect always. Inside an iframe every redirect targets the top-level window.

The merchant's page never embeds the Maytes flow — it opens the hosted checkout and reads authoritative state back via the merchant's `return_url` / `cancel_url` and via webhooks.

## Distribution

Three core bundle formats, plus the custom element, ship from `dist/`:

| Bundle | Format | Purpose |
|---|---|---|
| `checkout-button.js` | IIFE | `<script>` drop-in, attaches `window.Maytes` |
| `checkout-button.mjs` | ESM | `import { Maytes } from '@maytes/checkout-button'` in modern bundlers |
| `checkout-button.cjs` | CJS | `require('@maytes/checkout-button')` for legacy Node/CJS builds |
| `checkout-button.element.js` | IIFE | `<script>` drop-in for `<maytes-checkout-button>`; includes the core and also attaches `window.Maytes` |
| `element.mjs` / `element.cjs` | ESM / CJS | `import '@maytes/checkout-button/element'`; imports the core from `@maytes/checkout-button`, so npm users share one copy |

The IIFE (CDN) bundle ships minified with a sourcemap; the ESM/CJS (npm) bundles ship unminified so the consumer's bundler can minify them.

Each release is served from `https://js.maytes.co` under four URL forms:

| Form | Example | Cache | SRI |
|---|---|---|---|
| SemVer pin | `/v<version>/checkout-button.js` | 1 yr | yes |
| Content-hash pin | `/checkout-button.<8-char-sha256>.js` | 1 yr | yes |
| Internal dev branch | `/dev/checkout-button.js` | no cache | no (bytes roll) |
| Evergreen major (recommended) | `/v<major>/checkout-button.js` | ~5 min | no (bytes roll) |

The evergreen major channel (`/v1/checkout-button.js`) is the recommended production URL: merchants get every `1.x` release without bumping a pin, at the cost of SRI. Merchants who would rather freeze on a tested build pin a SemVer or hashed URL and set `<script integrity="…">`. `/dev/` is internal-only, for pre-merge testing (see below). [`cdn-versioning.md`](./cdn-versioning.md) records the reasoning. `integrity.json` at the CDN root lists the version, hash, and SRI for every bundle; hashing, SRI generation, and CSP linting all run in `npm run build`.

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
  radius?: number;  // corner radius in px, whole number 0–999, at most height/2 when height is set; default: pill
  height?: number;  // outer height in px, whole number 40–55; default: natural height
}

// Factory — each call returns an isolated instance:
const maytes = Maytes(options: MaytesOptions, internal?: MaytesInternalOptions): MaytesSDK;

interface OpenCheckoutOptions {
  mode?: RenderButtonMode;  // default: 'popup', same launch rules as the button
}

type OpenCheckoutResult =
  | { outcome: 'popup' }
  | { outcome: 'redirected'; target: 'self' | 'top' | 'tab' }
  | { outcome: 'failed'; reason: 'create-checkout-rejected' | 'invalid-shape' | 'navigation-blocked' }
  | { outcome: 'closed' }    // customer closed the popup before the checkout loaded
  | { outcome: 'ignored' };  // a launch from this instance was already in flight

interface MaytesSDK {
  readonly instanceId: string;  // stable per instance; every maytes:checkout-* event carries it as detail.instanceId
  renderButton(container: HTMLElement, options?: RenderButtonOptions): () => void;
  openCheckout(options?: OpenCheckoutOptions): Promise<OpenCheckoutResult>;
  onBusyChange(listener: (busy: boolean) => void): () => void;
  redirectToCheckout(options: { checkoutId: string; replace?: boolean }): void;
  checkoutUrl(options: { checkoutId: string }): string;
  destroy(): void;
}
```

`window.Maytes(opts)` reads like `window.Stripe(key)`. The IIFE build attaches the factory as `window.Maytes`; the ESM/CJS builds export `{ Maytes }`.

`openCheckout` runs the button's launch from the merchant's own button (for example a Stripe Payment Element checkout): it opens the blank popup synchronously during the call, so it must be called inside a click handler before any `await`. It reports how the launch ended, never the payment result.

`redirectToCheckout` / `checkoutUrl` are the headless path for power users and internal tooling (no button). `destroy()` tears down the instance — popup poll, any open popup, overlay, buttons, and listeners — in one shot and is idempotent; React cleanup is just `() => maytes.destroy()`.

`onBusyChange(listener)` reports the instance's busy state (`true` when a launch starts, `false` when it ends) and returns a function that stops listening; it throws `MaytesError(CONFIG)` on a destroyed instance.

### React bindings (`@maytes/checkout-button/react`)

`MaytesProvider` creates one instance per mount and destroys it on unmount (StrictMode-safe), reading the latest `createCheckout` through a ref; changing `environment` replaces the instance. `MaytesButton` renders `renderButton()` into its own `<div>` and forwards `maytes:checkout-*` events whose `detail.instanceId` is its provider's and `detail.source` is `'button'`. `useMaytes()` returns `{ openCheckout, busy }`; before the instance exists `openCheckout` resolves `{ outcome: 'ignored' }`. The entry is ESM/CJS only, starts with `"use client"`, imports the core from `@maytes/checkout-button` (external), and is never part of the CDN bundle; `scripts/react-entry-check.mjs` enforces all three after every build.

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

  alt default mode (popup) on a wide viewport
    Button->>Popup: window.open("about:blank", "maytes-checkout-*", 500x800), synchronously inside the click
    Button->>Popup: Paint branded loading screen
    Button->>Overlay: showModal() — dark backdrop, Maytes logo, "Completing checkout…"
    Button->>Page: dispatchEvent("maytes:checkout-opened")
    Note over Button,Popup: Button polls popup.closed every 500ms
  end

  Button->>MerchantBE: createCheckout() (merchant-owned closure)
  MerchantBE->>API: POST /api/merchant/v1/checkouts
  API-->>MerchantBE: { checkout_uuid, checkout_url }
  MerchantBE-->>Button: { checkoutId, checkoutUrl? }

  alt popup is open
    Button->>Popup: popup.location.replace(hosted checkout URL)
    Shopper->>Popup: Shares with mates, allocates, pays
    Popup->>API: GET / POST checkout endpoints
    API-->>Popup: Order state
    Popup->>Page: Sends the merchant page (window.opener) to return_url / cancel_url with checkout_id, then closes itself
    Note over Popup: With no usable opener, the popup navigates itself to return_url instead.
    opt Shopper closes the popup before finishing
      Note over Button: Next poll detects popup.closed === true
      Button->>Overlay: close() + remove from DOM
      Button->>Button: aria-disabled removed
      Button->>Page: dispatchEvent("maytes:checkout-closed")
    end
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
| `height` not a whole number from 40 to 55 | `MaytesError(CONFIG)`, before any style is injected |
| `radius` not a whole number from 0 to 999, or above `height / 2` when `height` is set | `MaytesError(CONFIG)`, before any style is injected |
| No `radius`/`height` | No inline style; the default pill exactly as before |
| No `redirectOverlay` (default) | Redirects show no overlay, exactly as before |
| `redirectOverlay: true` and the launch redirects (redirect mode, phone width, blocked popup) | The overlay ("Taking you to Maytes…", no "Return to Maytes" link) shows while `createCheckout` runs; it is removed on any failure, kept once the page navigates, and cleared with the busy state on a back/forward-cache restore (`pageshow` with `persisted`) |
| `redirectOverlay` not a boolean | `MaytesError(CONFIG)` |
| Click while this instance's `createCheckout` is in flight | No-op. A per-instance busy flag gates the instance's buttons and `openCheckout()`. Only the clicked button shows the spinner. |
| `<maytes-checkout-button>` connected without `createCheckout` | Renders nothing until the property is set |
| `mode`/`label`/`block`/`radius`/`height` attribute changes | The button is re-rendered on the same instance; an in-flight launch continues |
| `environment`/`nonce` attribute changes | The instance is re-created, after any in-flight launch ends |
| Invalid attribute on `<maytes-checkout-button>` | `console.error` + `maytes-failed` with `{ reason: 'config', cause }`; never throws |
| `<maytes-checkout-button>` removed (not just moved) | Instance destroyed on the next microtask; a move keeps an in-flight launch |
| `<maytes-checkout-button>` imported during SSR | No `window`/`customElements` access; nothing is defined |
| `openCheckout()` while a launch is in flight | Resolves `{ outcome: 'ignored' }`; `createCheckout` is not called again. |
| `openCheckout()` on a destroyed instance, or with an invalid `mode` | Throws `MaytesError(CONFIG)` synchronously. |
| `openCheckout()` outcomes | Same flow as a click; resolves `popup`, `redirected` (`target`), `failed` (`reason`), or `closed` (popup closed before the checkout loaded). Never rejects. |
| Any `maytes:checkout-*` event | `detail.instanceId` is the sending instance's `instanceId`; `detail.source` is `'button'` (rendered button) or `'api'` (`openCheckout()`). `opened`/`closed` now carry this detail; the existing `redirected`/`failed` fields are unchanged. |
| `createCheckout` rejects | Button re-enables, overlay clears, `console.error`, `maytes:checkout-failed` (reason `create-checkout-rejected`). |
| `createCheckout` resolves the wrong shape | Same as rejection, reason `invalid-shape`. |
| Default mode (`popup`) on a wide viewport | Blank popup opened synchronously, branded loader painted, then `popup.location.replace(url)`; `maytes:checkout-opened`. The width is the top window's (or the screen's when the top is cross-origin), never the iframe's. |
| Default mode (`popup`) on a phone | Behaves as `redirect`. |
| `mode: 'redirect'`, or blocked popup | Top-level navigation to the hosted checkout; `maytes:checkout-redirected` (`detail.url`, `detail.target`). No `failed` event. |
| Framed, top window refuses the navigation | New tab with `opener` severed; `maytes:checkout-redirected` (`target: 'tab'`). |
| Framed, top window and new tab both refused | Button re-enables, `console.error`, `maytes:checkout-failed` (reason `navigation-blocked`, `cause` = the refusal). |
| At least half of a button is on screen and the page is visible, in `production` or the internal `staging` environment | One `no-cors` GET of `https://js.maytes.co/button-shown.txt` with the origin only as referrer, once per `location.pathname` per window across every copy of the SDK. Never in `sandbox`. Failures are silent and never affect the button. |
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
├── button.ts       # renderButton() — DOM building, option validation, busy view; click → launchCheckout()
├── launch.ts       # launchCheckout() — popup loader, overlay, createCheckout, navigation, events, launch result; shared by the button and openCheckout()
├── redirect.ts     # checkoutUrl + redirectToCheckout (URL build + nav)
├── framing.ts      # isFramed / sameOriginTop / viewportWidth / navigateTopLevel (leave an embedding iframe)
├── env.ts          # isValidEnvironment, resolveBaseUrl (env → URL)
├── styles.ts       # ensureStylesInjected / releaseStyles (refcounted)
├── overlay.ts      # full-screen <dialog> with Maytes logo + spinner; mounts in the same-origin top document when framed
├── branding.ts     # Maytes logo SVG + brand colors
├── types.ts        # public type surface + global Window augmentation
├── errors.ts       # MaytesError + MaytesErrorCode
├── element.ts      # <maytes-checkout-button>: a light-DOM consumer of the public API (attributes, createCheckout property, per-instance events, open())
├── version.ts      # SDK_VERSION literal (generated from package.json)
├── react/          # optional React bindings (subpath export, not in the CDN bundle)
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
npm test              # vitest in watch mode
npm run test:run      # single-shot
npm run test:coverage # single-shot with coverage thresholds enforced, used by CI
npm run typecheck     # tsc --noEmit
```

Coverage — **264 tests across 19 files** (`src/test/`):

| File | Tests | What it covers |
|---|---|---|
| `init.test.ts` | 10 | factory validation (`createCheckout` type, `environment` enum), internal `baseUrl` passthrough |
| `button.test.ts` | 74 | render → click → closure → default popup launch (`about:blank` sync open, branded loader, `location.replace` navigation), explicit redirect mode, phone redirect fallback, blocked-popup redirect event, unique per-instance window name, busy gating, double-click suppression, destroy-mid-flight guard, listener detach on destroy, versioned style marker, immediate overlay clear on Escape, rejection / invalid-shape recovery, env → URL mapping, `baseUrl` override, popup-closed polling + overlay teardown, `maytes:checkout-*` events, cleanup/`destroy` idempotency, style refcounting, `cspNonce` presence/absence, `label` / `block` / `mode` props, multi-button concurrency, framed navigation (same-origin top window on a phone, popup sizing from the top window, cross-origin top window allowing navigation, a refused top navigation opening a new tab, both refused failing loudly and re-enabling the button), the busy spinner reappearing on every checkout attempt, not just the first |
| `open-checkout.test.ts` | 18 | `openCheckout()`: blank popup opened during the call before `createCheckout`, popup navigation and `opened` event, `checkoutUrl` passthrough, phone and `redirect`-mode redirects, blocked-popup fallback, `failed` for rejection / invalid shape / refused iframe navigation (never rejects), `ignored` while a launch is in flight, CONFIG for a destroyed instance or invalid mode, `closed` when destroyed or the popup is closed before the checkout loads; while a launch is in flight every button on the instance and `openCheckout()` are gated, and only the clicked button shows the spinner |
| `busy-change.test.ts` | 4 | `onBusyChange()`: `true`/`false` around a button launch and an `openCheckout()` launch, the stop function, CONFIG on a destroyed instance |
| `react-provider.test.tsx` | 8 | `MaytesProvider` + `useMaytes()`: one instance per mount, StrictMode leaves one, latest `createCheckout` without re-instantiation, `environment` change replaces the instance, `busy` follows the launch, unmount mid-launch closes the popup and never navigates, `ignored` before the instance exists, clear error outside the provider |
| `react-events.test.ts` | 3 | `listenToInstanceEvents()`: forwards its own instance + source, ignores other instances/sources/detail-less events, calls the latest handlers, stops |
| `react-button.test.tsx` | 10 | `MaytesButton`: one SDK button under StrictMode, `radius`/`height` passthrough, `redirectOverlay` on a same-tab launch (and none without it), re-render without duplicates, callbacks only for its own provider and for button launches, opened/closed/redirected forwarding, cleanup on unmount, clear error outside the provider |
| `react-ssr.test.tsx` | 1 | `renderToString` in a node environment with no `window`/`document` |
| `react-entry-check.test.ts` | 5 | build-output checks: no React in the CDN bundle, `"use client"` on both React entries, the core imported not bundled, core types imported not inlined |
| `element.test.ts`, `element-ssr.test.ts` | 28 | `<maytes-checkout-button>`: idempotent definition, SSR-safe import, nothing rendered until `createCheckout` is set (before or after connecting), light DOM, attributes → options, nonce, a replaced `createCheckout` without re-rendering, removal destroys the instance and closes an unloaded popup, a DOM move keeps an in-flight launch, attribute re-render keeping the launch, environment re-create deferred until the launch ends, config errors as `maytes-failed` `reason: 'config'`, per-instance event forwarding (bubbling, composed), `open()` |
| `framing.test.ts` | 10 | `isFramed` / `sameOriginTop` / `viewportWidth` at top level and when framed, falling back to the screen width when the top window is cross-origin (and to the local width when the screen width is unknown), `navigateTopLevel` targeting the top window, opening a tab with `opener` severed when the top window refuses, reporting the refusal when both are blocked, rethrowing failures that aren't a `SecurityError`, recognising a `SecurityError` thrown from another realm as a top-window refusal or as a cross-origin top window |
| `env.test.ts` | 24 | `isValidEnvironment` (positive, negative and non-string values via `it.each`, type-guard narrowing), `resolveBaseUrl` (sandbox / staging / production mapping, override precedence, empty-string override, defence-in-depth throw on unknown env) |
| `state.test.ts` | 7 | popup-name generation (`crypto.randomUUID` + fallback), `createInstanceState` config passthrough and defaults |
| `redirect.test.ts` | 20 | URL construction, trailing-slash strip, URL encoding, empty / whitespace `checkoutId`, `replace` vs `href` navigation, framed navigation (a same-origin top window honouring `replace`, throwing `MaytesError` when a cross-origin top window and a new tab are both refused), and direct `isHttpUrl` unit cases for accepted `http(s)` URLs and rejected `javascript:`/`data:`/malformed/empty/non-`http(s)` values |
| `overlay.test.ts` | 15 | `hideOverlay` no-op when nothing was shown, mounting into the local document at top level, mounting into a same-origin top document when framed (with its style tag cloned along, and deduped when the top document already carries the marker), falling back to the local document when the top window throws `SecurityError`, removing the overlay from the parent document (and unsubscribing `pagehide`) when the frame navigates away or the overlay is hidden, `showOverlay` being idempotent against a second call while shown, the native-`showModal` success and fallback-to-inline-backdrop paths (unavailable and throwing), and the "Return to Maytes" link refocusing an open popup, no-op'ing with no popup, and swallowing a `SecurityError` from `popup.focus()` |
| `styles.test.ts` | 5 | direct `ensureStylesInjected`/`releaseStyles` ref-counting (no button/DOM involved) |
| `branding.test.ts` | 4 | `buildMaytesLogo` SVG contract (viewBox, sizing, path structure) |
| `errors.test.ts` | 8 | `MaytesError` is an `Error`, code/message/name/stack present, `toString` serialization, `MaytesErrorCode.Config === 'CONFIG'`, code surface is `{ Config }` only |
| `changelog.test.ts` | 14 | unit-tests the release-script changelog slicer (`scripts/lib/changelog.mjs`), not SDK behaviour: section-bounds lookup, section extraction, SRI block injection (including the never-invent-a-section guard and idempotent re-runs), SRI record extraction across every released version |
| `shown.test.ts` | 20 | the button-shown report: the exact request, which environments send, the half-visible and page-visible rules, once per path across SDK copies, teardown, and silence when `IntersectionObserver` or `fetch` is missing or failing |
| `cdn-config.test.ts` | 9 | unit-tests `scripts/lib/cdn-config.mjs`: the shown-report file URL matching the SDK's, SemVer and `/v{major}` path building, hashed URL building, leading-slash normalization, a pinned SemVer redirect for every tracked release, one evergreen redirect per major, and a fixed header set |
| `cdn-cache-rules.test.ts` | 24 | unit-tests `scripts/lib/cdn-cache-rules.mjs`: the three fixed Cloudflare Cache Rules scoped to `js.maytes.co` (immutable pins, evergreen, dev-branch bypass), wildcard disambiguation between pinned SemVer, content-hash and evergreen paths, the unhashed-bundle exclusion, and `rulesetNeedsUpdate` change detection |
| `cdn-dev-redirect.test.ts` | 8 | unit-tests `scripts/lib/cdn-dev-redirect.mjs`: the `/dev/*` → Pages-preview redirect rule's scope, target expression, and status code, and `redirectNeedsUpdate` change detection |
| `release-verification.test.ts` | 7 | unit-tests the CDN history rehydration checks: `verifyReleaseHash` against the CHANGELOG record with an `integrity.json` fallback, `checkTagCoverage` for new repos, the version threshold and missing tags |
| `semver-lite.test.ts` | 6 | unit-tests `compareVersions` (numeric major/minor/patch ordering) and `latestPerMajor` (highest version per major, order-independent) |
| `readme.test.ts` | 5 | unit-tests `scripts/lib/readme.mjs`'s CDN-example injector: no-op when the markers are absent, replaces both example URLs, leaves the surrounding prose untouched, idempotent re-run, keeps the SRI placeholder as a literal ellipsis |
| `foundation.test.ts` | 2 | vendored brand tokens (`src/foundation/brand.generated.ts`) match `foundation.lock.json`'s tag, every role the button uses is an opaque hex colour |
| `docs-examples.test.ts` | 13 | type-checks every SDK example in `README.md` and `docs/guides/` (TypeScript, JavaScript and the `<script>` of Vue and Svelte blocks) against `src/index.ts`, with minimal framework stubs; a block can opt out with `<!-- typecheck: skip -->` |

Run `npm run test:coverage` for a coverage report (thresholds: 90% lines/statements/functions, 85% branches — enforced in both `pr.yml` and `release.yml`).

### End-to-end testing

Manual end-to-end verification against a real (sandbox) checkout requires a merchant backend that can mint one via the Maytes API — see [Create a checkout](https://developers.maytes.co/create-checkout) in the merchant docs. This repo's own unit tests (above) cover the button's behaviour in isolation with a stubbed `createCheckout`.

### CSP / integrity verification

```bash
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

The Maytes-hosted checkout the button navigates to is a separate, backend-owned application — not part of this repo. It's bootstrapped purely from the `?id=<uuid>` URL param (no `postMessage` handshake), and at terminal status redirects the shopper to the merchant's `return_url` / `cancel_url` as described in [End-to-end flow](#end-to-end-flow) above.

## Mobile app deep links

The button hands off only to the merchant's `return_url` / `cancel_url` — it never links to the Maytes app directly. Separately, the **paylinks** app (`app.maytes.co`, `staging-app.maytes.co`) serves `/.well-known/apple-app-site-association` + `/.well-known/assetlinks.json`, so the payment links shoppers share with mates open in the Maytes app on installed devices via iOS Universal Links / Android App Links, falling back to the browser otherwise. Nothing in this SDK configures or depends on that; it is noted here only because the end-to-end "split with mates" flow terminates on those links.

## Deferred / known follow-ups

- **CDN: live.** Cloudflare Pages project `checkout-button` is deployed at `https://js.maytes.co` (release workflow + `scripts/cdn-config.mjs`). `/dev/<bundle>` aliases the unhashed names for development auto-updates; `/v<version>/<bundle>` aliases each release's hashed bundle; hashed filenames are immutable. Every historical release's pins now persist across later releases — before this, shipping a new release 404'd the previous ones — and `/v<major>/<bundle>` serves the newest release in that major as an opt-in evergreen alias.
- **`onComplete` request.** If we ever need an in-page completion signal for analytics, the right design is `BroadcastChannel` between the checkout tab and the merchant tab — *not* re-adding callbacks (they'd be unreachable in the canonical same-tab flow).
