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

```html
<script src="https://js.maytes.co/v1.0.0/checkout-button.js"
        integrity="sha384-…"
        crossorigin="anonymous"></script>
```

```html
<script src="https://js.maytes.co/checkout-button.795d508b.js"
        integrity="sha384-…"
        crossorigin="anonymous"></script>
```

`v1.0.0` / `795d508b` are examples. The real version, hash, and SRI for each release live in [`CHANGELOG.md`](./CHANGELOG.md), the matching [release](https://github.com/kttipay/checkout-button/releases), and `https://js.maytes.co/integrity.json`.

Use a pinned URL in every environment, development included — pinning is what makes the bytes you tested the bytes your shoppers get.

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
| `destroy()` | Tear down the instance and its listeners. |

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
