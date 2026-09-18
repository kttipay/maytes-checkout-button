<p align="center">
  <img src=".github/logo.svg" height="32" alt="Maytes">
</p>

<h1 align="center">@maytes/checkout-button</h1>

<p align="center">
  Drop-in <strong>Split with Maytes</strong> button — one script or import, and shoppers can split any checkout with friends.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@maytes/checkout-button"><img alt="npm version" src="https://img.shields.io/npm/v/@maytes/checkout-button?color=4A0324&label=npm"></a>
  <a href="https://bundlephobia.com/package/@maytes/checkout-button"><img alt="bundle size" src="https://img.shields.io/bundlephobia/minzip/@maytes/checkout-button?color=FE572A&label=gzip"></a>
  <a href="./CHANGELOG.md"><img alt="provenance" src="https://img.shields.io/badge/npm-provenance-4A0324"></a>
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-4A0324"></a>
  <a href="https://developers.maytes.co/checkout-button"><img alt="docs" src="https://img.shields.io/badge/docs-developers.maytes.co-FE572A"></a>
</p>

---

Renders a button and launches the Maytes-hosted checkout in the top-level window. Default mode is same-window redirect; `mode: 'popup'` opts wide viewports into a centered popup with a branded loader and falls back to a redirect on phones or when the popup is blocked. Inside an iframe the redirect always targets the top-level window.

**📖 Full integration guide:** [developers.maytes.co/checkout-button](https://developers.maytes.co/checkout-button)

- **Framework-agnostic** — same factory whether it's a `<script>` tag or `import { Maytes }`; no React/Vue/Angular binding to keep in sync.
- **Zero runtime dependencies** — a small, dependency-free bundle; ESM/CJS ship unminified so your bundler can tree-shake it.
- **CSP-safe by construction** — no `eval`, `Function`, or string-form timers; every release is scanned for it before shipping.
- **SRI-verified CDN** — pin a release by SemVer or content hash, both carrying the same integrity hash, published alongside every release.
- **Signed provenance** — every npm release carries a [SLSA](https://slsa.dev) provenance attestation back to this repo's build.

## Contents

- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Mobile app](#mobile-app)
- [Development](#development)

## Install

### Script tag (CDN)

For production, pin an exact release. The readable SemVer URL and the content-hash URL are two names for the **same release bytes** and share the **same SRI value** — pick either:

<!-- @cdn-example-start -->
```html
<script src="https://js.maytes.co/v1.0.1/checkout-button.js"
        integrity="sha384-…"
        crossorigin="anonymous"></script>
```

```html
<script src="https://js.maytes.co/checkout-button.8c71493e.js"
        integrity="sha384-…"
        crossorigin="anonymous"></script>
```
<!-- @cdn-example-end -->

The real version, hash, and SRI for each release live in [`CHANGELOG.md`](./CHANGELOG.md), the matching [release](https://github.com/kttipay/maytes-checkout-button/releases), and `https://js.maytes.co/integrity.json`.

Use a pinned URL in every environment, development included — pinning is what makes the bytes you tested the bytes your shoppers get.

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

This isn't a way to get bug fixes faster than pinning — a fix ships the same way either way (a new release), and if you're pinned, bumping your pin to the new version is exactly as fast as staying on `/v1/` would have been. What you're actually trading is safety: on `/v1/`, a bad release reaches you the moment it ships, with no way to stay back on the last good build. While `1.x` is the newest major, `https://js.maytes.co/integrity.json` reflects whatever `/v1/` currently serves, if you want to poll it and alert on unexpected changes yourself — it describes the newest release only, so once a `2.0.0` ships it stops describing `/v1/` (which stays on the last `1.x`).

`/v1/` only ever tracks `1.x`. When a breaking `2.0.0` ships, `/v1/` keeps resolving to the last `1.x` release rather than disappearing or jumping to `2.x` — move to `/v2/checkout-button.js` explicitly when you're ready.

### npm

```bash
npm install @maytes/checkout-button
```

## Usage

`Maytes` is a callable factory (Stripe-style). Each call returns an isolated SDK instance.

```ts
import { Maytes } from '@maytes/checkout-button';

const maytes = Maytes({
  createCheckout: async () => {
    const res = await fetch('/api/maytes/create-checkout', { method: 'POST' });
    return res.json(); // { checkoutId: string, checkoutUrl?: string }
  },
  environment: 'sandbox',
});

const cleanup = maytes.renderButton(document.getElementById('slot'), { block: true });

// Optional popup mode:
maytes.renderButton(document.getElementById('popup-slot'), { block: true, mode: 'popup' });

// Imperative alternatives:
maytes.redirectToCheckout({ checkoutId });
const url = maytes.checkoutUrl({ checkoutId });

// Teardown:
cleanup();
maytes.destroy();
```

Via the script tag, the same factory is available as the global `window.Maytes(...)`.

## API

| Method | Purpose |
|---|---|
| `Maytes(options)` | Create an SDK instance. `options.createCheckout` mints a checkout server-side; `options.environment` selects the Maytes environment. |
| `renderButton(container, options?)` | Render the button into `container`; returns a cleanup function. Options include `label`, `block`, and `mode: 'redirect' \| 'popup'`. |
| `redirectToCheckout(options)` | Launch checkout directly (no button). |
| `checkoutUrl(options)` | Build the hosted checkout URL. |
| `destroy()` | Tear down the instance and its listeners — call this on unmount or when the instance's config/environment changes, not as a reaction to detecting payment success from your own polling (that can tear down a checkout that's still in progress). To remove a single button, use the cleanup function returned by `renderButton()` or hide/disable the button element instead. |

### Inside an iframe?

The hosted checkout must run in the top-level window (its session cookie is refused inside a cross-site frame). If you render the button inside an iframe, the SDK navigates the top-level window; if the browser refuses, it opens a new tab; if both are refused it dispatches `maytes:checkout-failed` with `reason: 'navigation-blocked'`. When the checkout opens in a new tab, no popup poll starts and no `maytes:checkout-opened` / `maytes:checkout-closed` pair fires — you'll only see `maytes:checkout-redirected` with `target: 'tab'`. A sandboxed iframe needs `allow-scripts allow-same-origin allow-top-navigation` (plus `allow-popups allow-popups-to-escape-sandbox` for the tab fallback). Listen to `maytes:checkout-redirected` and read `event.detail.target` (`'self'`, `'top'` or `'tab'`) if your page needs to know where the checkout went. Rendering the button in the top-level page avoids all of this.

## Mobile app

After checkout, shoppers split the cost with friends using Maytes payment links (`app.maytes.co/…`). On a phone with the Maytes app installed, those links open directly in the app (iOS Universal Links / Android App Links); otherwise they open in the browser. Maytes handles this end to end — merchants integrate only the button and configure nothing for the app.

## Development

```bash
npm ci
npm run dev          # tsup watch
npm run typecheck
npm run test:run
npm run build        # bundles + SRI hashes + CSP scan
```

Versioning and changelog are managed with [Changesets](./.changeset/README.md). Run `npm run changeset` with your PR. Brand colours are vendored, not hand-written — see [`RELEASING.md`](./RELEASING.md#brand-colours-come-from-the-design-foundation) for how that works.

## License

[MIT](./LICENSE)
