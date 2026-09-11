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
</p>

---

Renders a button and launches the Maytes-hosted checkout. Default mode is same-window redirect; `mode: 'popup'` opts desktop browsers into a centered popup with a branded loader and redirect fallback on mobile or when blocked.

## Contents

- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Mobile app](#mobile-app)
- [Development](#development)
- [Brand colours](#brand-colours-come-from-the-design-foundation)

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

Versioning and changelog are managed with [Changesets](./.changeset/README.md). Run `npm run changeset` with your PR.

## Brand colours come from the design foundation

The Maytes brand colours the button paints (`brand.primary` burgundy, `brand.secondary` orange, the burgundy/700 hover shade, and the inverse text white) are **not hand-written** in this package. They are vendored from the design foundation — `kttipay/designsystem` `web/tokens.ts` — into `src/foundation/brand.generated.ts`, pinned to a release tag recorded in `foundation.lock.json`:

```json
{ "repo": "kttipay/designsystem", "tag": "v0.3.0", "source": "web/tokens.ts" }
```

- `src/branding.ts`, `src/styles.ts` and `src/button.ts` read every brand colour from that generated module. Never type a Maytes hex into `src/`.
- To move to a newer foundation release: `npm run sync:foundation -- --tag vX.Y.Z` (fetches the file at that tag with `gh api`, so you need a logged-in `gh`; `--from ../path/to/designsystem/web/tokens.ts` works offline). The script rewrites the generated module and the lock file. Commit both together.
- A vitest test fails if the generated header's tag drifts from `foundation.lock.json`, so the file can only change through the script.

The design-system repo does not publish an npm package yet. When it does (`@kttipay/foundation` on GitHub Packages), the upgrade path is to replace the vendored module with that dependency and delete the script and lock file.

## License

[MIT](./LICENSE)
