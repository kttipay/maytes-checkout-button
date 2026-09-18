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

Renders a button and launches the Maytes-hosted checkout. Default mode is same-window redirect; `mode: 'popup'` opts desktop browsers into a centered popup with a branded loader and redirect fallback on mobile or when blocked.

**📖 Full integration guide:** [developers.maytes.co/checkout-button](https://developers.maytes.co/checkout-button)

- **Framework-agnostic** — same factory whether it's a `<script>` tag or `import { Maytes }`; no React/Vue/Angular binding to keep in sync.
- **Zero runtime dependencies** — a small, dependency-free bundle; ESM/CJS ship unminified so your bundler can tree-shake it.
- **CSP-safe by construction** — no `eval`, `Function`, or string-form timers; every release is scanned for it before shipping.
- **Evergreen CDN by default** — the recommended `<script>` tag always serves the newest release automatically; pin a release by SemVer or content hash instead if you'd rather freeze on a tested build.
- **Signed provenance** — every npm release carries a [SLSA](https://slsa.dev) provenance attestation back to this repo's build.

## Contents

- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Mobile app](#mobile-app)
- [Development](#development)

## Install

### Script tag (CDN)

|  | Evergreen (recommended) | Pinned |
|---|---|---|
| **Use when** | Default choice — get the newest `1.x` release automatically | You'd rather freeze on a tested build and update on your own schedule |
| **Guarantee** | Always current; a bad release reaches everyone on it immediately | The bytes you tested are the bytes shipped, forever |
| **SRI** | Not possible | Yes |

### Evergreen (auto-updating URL, recommended)

```html
<script src="https://js.maytes.co/v1/checkout-button.js"
        crossorigin="anonymous"></script>
```

This URL has no `integrity` attribute, and can't have one: it moves to whichever `1.x` release is newest (~5 minute edge cache), so the bytes behind it change without notice. Restrict which origins your page trusts via CSP instead of a content hash:

```
Content-Security-Policy: script-src 'self' https://js.maytes.co;
```

This isn't a way to get bug fixes faster than pinning — a fix ships the same way either way (a new release). What you get from `/v1/` is not having to separately notice each release and bump a pin yourself; what you give up is that a bad release reaches you the moment it ships, with no way to stay back on the last good build. `https://js.maytes.co/integrity.json` reflects whatever `/v1/` currently serves while `1.x` is the newest major, if you want to poll it and alert on unexpected changes yourself — it stops describing `/v1/` once a `2.0.0` ships (which stays on the last `1.x`; move to `/v2/checkout-button.js` explicitly when you're ready).

### Pinned (SemVer or content hash)

If you'd rather trade `/v1/`'s convenience for a guarantee — freeze on a tested build, update on your own schedule — pin an exact release instead. The readable SemVer URL and the content-hash URL are two names for the **same release bytes** and share the **same SRI value** — pick either:

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

The real version, hash, and SRI for each release live in [`CHANGELOG.md`](./CHANGELOG.md), the matching [release](https://github.com/kttipay/maytes-checkout-button/releases), and `https://js.maytes.co/integrity.json`. A pinned URL never changes once published — every SemVer and content-hash pin survives across future releases, so it's a durable fallback whenever you want it.

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
