# Security and CSP

Where credentials live, and how to run the button under a strict Content Security Policy.

- **Keep credentials on your server.** The browser only ever sees `checkoutId` and `checkoutUrl`. Treat `checkoutId` like a magic link: it identifies the shopper's checkout session.
- **Price on the server.** Send a cart or order reference from the browser and price it from your own catalogue; never trust a browser-supplied total.

## Scripts

Allow the CDN:

```
Content-Security-Policy: script-src 'self' https://js.maytes.co;
```

With a pinned URL you can also add an `integrity` attribute (SRI); the evergreen `/v1/` URL can't have one because its bytes change with each `1.x` release. Pinned URLs and their SRI hashes are in [Install and versioning](https://github.com/kttipay/maytes-checkout-button#install) and the [CHANGELOG](https://github.com/kttipay/maytes-checkout-button/blob/main/CHANGELOG.md).

If your policy restricts connections (`connect-src`, or `default-src` without it), also allow `https://js.maytes.co` there. This applies to npm installs too.

## What the button sends

In production, the first time a button is on screen on a page, the SDK requests an empty file from `js.maytes.co` so that Maytes can count how often buttons are shown on each site. The request carries your site's origin (not the page address) and no cookies or shopper identifiers. As with any request, Cloudflare receives the shopper's IP address and browser details.

If your policy blocks the request, the button works as usual, and the browser reports the policy violation.

## Styles

The button injects a `<style>` tag. On a strict `style-src` policy, pass your nonce as the second argument so it's set on every style tag the SDK adds, including the popup's loading screen and the page overlay:

```ts
import { Maytes } from '@maytes/checkout-button';

const maytes = Maytes({ createCheckout, environment: 'production' }, { cspNonce: 'your-nonce' });
```

## No eval

The bundle uses no `eval`, `Function` or string-form timers, and every release is scanned for them, so `'unsafe-eval'` is never needed.

Next: [Troubleshooting](https://github.com/kttipay/maytes-checkout-button/blob/main/docs/guides/troubleshooting.md)
