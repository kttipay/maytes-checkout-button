<p align="center">
  <img src=".github/logo.svg" height="32" alt="Maytes">
</p>

<h1 align="center">@maytes/checkout-button</h1>

<p align="center">
  The <strong>Split with Maytes</strong> button for your checkout page.<br>
  Shoppers pay their share of the order and invite friends to pay theirs.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@maytes/checkout-button"><img alt="npm version" src="https://img.shields.io/npm/v/@maytes/checkout-button?color=4A0324&label=npm"></a>
  <a href="./CHANGELOG.md"><img alt="provenance" src="https://img.shields.io/badge/npm-provenance-4A0324"></a>
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-4A0324"></a>
  <a href="https://developers.maytes.co/checkout-button"><img alt="docs" src="https://img.shields.io/badge/docs-developers.maytes.co-FE572A"></a>
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> ·
  <a href="#choose-your-setup">Guides</a> ·
  <a href="#install">Install</a> ·
  <a href="#api">API</a> ·
  <a href="https://developers.maytes.co/checkout-button">Integration guide</a>
</p>

When a shopper clicks the button, it asks your server to create a Maytes checkout and opens it in a popup, or in the same tab on phones. Your server captures the payment when Maytes sends the `checkout.authorized` webhook.

## Features

- **Any stack.** A `<script>` tag or `import { Maytes }`, with [a guide per stack](#choose-your-setup), React components and a web component.
- **No dependencies.** ESM and CommonJS builds ship unminified, so your bundler tree-shakes them.
- **CSP-safe.** No `eval`, `Function` or string timers; every release is scanned.
- **Evergreen CDN.** `/v1/` always serves the newest `1.x`, so you get fixes without redeploying.
- **Signed releases.** Every npm release carries [SLSA](https://slsa.dev) provenance.

## Quickstart

```html
<div id="maytes-button"></div>

<script src="https://js.maytes.co/v1/checkout-button.js" crossorigin="anonymous"></script>
<script>
  const maytes = window.Maytes({
    environment: 'sandbox',
    createCheckout: async () => {
      const res = await fetch('/api/maytes/checkout', { method: 'POST' });
      if (!res.ok) throw new Error('Could not create the Maytes checkout');
      return res.json(); // { checkoutId, checkoutUrl }
    },
  });

  maytes.renderButton(document.getElementById('maytes-button'), { block: true });
</script>
```

Your server creates the checkout behind `POST /api/maytes/checkout`; [Your server](docs/guides/server.md) shows how. Using a framework? Pick it below.

<a id="usage"></a>

## Choose your setup

- **Frontend:** [HTML](docs/guides/quickstart-html.md) · [npm](docs/guides/quickstart-npm.md) · [React](docs/guides/react.md) · [Next.js](docs/guides/nextjs.md) · [Vue and Nuxt](docs/guides/vue-nuxt.md) · [Angular](docs/guides/angular.md) · [Svelte](docs/guides/svelte.md) · [Solid](docs/guides/solid.md) · [Web component](docs/guides/web-component.md)
- **Integration:** [Your server](docs/guides/server.md) · [Stripe Payment Element](docs/guides/stripe-payment-element.md) · [Your own button](docs/guides/own-button.md)

## Install

**Script tag**

```html
<script src="https://js.maytes.co/v1/checkout-button.js"
        crossorigin="anonymous"></script>
```

Always serves the newest `1.x` release, so you get fixes without redeploying. It won't jump to a future `2.x`: move to `/v2/checkout-button.js` yourself once that ships.

<details>
<summary><b>CSP</b></summary>

Allow the CDN origin in your Content Security Policy:

```
Content-Security-Policy: script-src 'self' https://js.maytes.co;
```

If your policy restricts connections (`connect-src`, or `default-src` without it), also allow `https://js.maytes.co` there. See [What the button sends](docs/guides/security-csp.md#what-the-button-sends).

No `integrity` attribute is possible on this URL, because its bytes change as new `1.x` releases ship. Poll `https://js.maytes.co/integrity.json` if you want to detect changes yourself.

</details>

**npm**

```bash
npm install @maytes/checkout-button
```

ESM (`import`) and CommonJS (`require`) builds ship unminified with type declarations; your bundler minifies them.

If your Content Security Policy restricts connections, allow `https://js.maytes.co` in `connect-src`. See [What the button sends](docs/guides/security-csp.md#what-the-button-sends).

## API

`Maytes` is a callable factory, like `Stripe()`. Each call returns an isolated instance.

```ts
import { Maytes } from '@maytes/checkout-button';

const maytes = Maytes({
  environment: 'sandbox',
  createCheckout: async () => {
    const res = await fetch('/api/maytes/checkout', { method: 'POST' });
    if (!res.ok) throw new Error('Could not create the Maytes checkout');
    return res.json(); // { checkoutId, checkoutUrl }
  },
});

maytes.renderButton(document.getElementById('maytes-button')!, { block: true });
```

| Member | Purpose |
|---|---|
| `Maytes({ createCheckout, environment })` | Creates an instance. `createCheckout` asks your server for `{ checkoutId, checkoutUrl? }`; `environment` is `'sandbox'` or `'production'`. |
| `renderButton(container, { label, block, mode, radius, height })` | Renders the button and returns a function that removes it. `mode` is `'popup'` (default) or `'redirect'`; `radius` and `height` fit it next to wallet buttons. |
| `openCheckout({ mode })` | Starts the checkout from your own button, as a click on the rendered button does. See [Using your own button](docs/guides/own-button.md). |
| `instanceId` | Read-only id of the instance; every `maytes:checkout-*` event carries it in `event.detail`. |
| `onBusyChange(listener)` | Calls `listener(true)` when a launch starts and `listener(false)` when it ends; returns a function that stops listening. |
| `redirectToCheckout({ checkoutId, replace })` | Sends the current tab to a checkout you already created. |
| `checkoutUrl({ checkoutId })` | Builds the hosted checkout URL. |
| `destroy()` | Tears down the instance, its buttons, listeners and overlay. Call it on unmount. |
| `maytes:checkout-opened` / `-closed` / `-redirected` / `-failed` | `CustomEvent`s on `document` describing what the button did. |

Style the button from CSS with `--maytes-button-height`, `--maytes-button-radius` and `--maytes-button-font-size`; see the [API reference](docs/guides/api.md#styling-with-css-custom-properties).

Full reference: [API](docs/guides/api.md) · [Events](docs/guides/events.md).

## More guides

- **Reference:** [API](docs/guides/api.md) · [Events](docs/guides/events.md) · [Popup, redirect and iframes](docs/guides/launch-behaviour.md) · [Security and CSP](docs/guides/security-csp.md)
- **Help:** [Troubleshooting](docs/guides/troubleshooting.md)
- **Internals:** [Technical overview](docs/overview.md) · [CDN versioning decision record](docs/cdn-versioning.md)

The same guides ship in the npm package under `docs/guides/` and are published on [developers.maytes.co](https://developers.maytes.co/checkout-button).

## Using an AI coding assistant

This repository ships an [Agent Skill](https://github.com/kttipay/maytes-checkout-button/tree/main/skills/maytes-checkout-button) that teaches coding assistants to add Split with Maytes correctly on any stack: credentials stay on your server, `createCheckout` returns `{ checkoutId, checkoutUrl }`, the button is created in browser-only code and destroyed on unmount, and the webhook captures the payment.

In Claude Code:

```
/plugin marketplace add kttipay/maytes-checkout-button
/plugin install maytes-checkout-button@maytes
```

Then ask, for example, "add Split with Maytes to my checkout". Other assistants that support Agent Skills can use the [`skills/maytes-checkout-button`](https://github.com/kttipay/maytes-checkout-button/tree/main/skills/maytes-checkout-button) folder directly. The skill covers only the released API.

## Mobile app

After checkout, shoppers split the cost with friends using Maytes payment links (`app.maytes.co/…`). With the Maytes app installed, those links open in the app (iOS Universal Links / Android App Links); otherwise in the browser. Maytes handles this end to end — you integrate only the button and configure nothing for the app.

## Development

```bash
npm ci
npm run dev          # tsup watch
npm run typecheck
npm run test:run
npm run build        # bundles + SRI hashes + CSP scan
```

Versioning and changelog are managed with [Changesets](./.changeset/README.md). Run `npm run changeset` with your PR. Brand colours are vendored, not hand-written — see [`RELEASING.md`](./RELEASING.md#brand-colours-come-from-the-design-foundation) for how that works. Internals, the end-to-end sequence and behaviour contracts are in [`docs/overview.md`](./docs/overview.md).

## License

[MIT](./LICENSE)
