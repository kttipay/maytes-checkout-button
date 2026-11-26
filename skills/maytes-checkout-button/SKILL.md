---
name: maytes-checkout-button
description: Add the Split with Maytes button (@maytes/checkout-button) to a website or checkout page, including a checkout that already uses Stripe's Payment Element. Use when the user asks to add Split with Maytes, the Maytes checkout button, or Maytes as a payment option to a site or checkout built with plain HTML, a bundler, React, Next.js, Vue, Nuxt, Angular, Svelte or Solid, or asks how to wire Maytes createCheckout, webhooks or capture.
---

# Add Split with Maytes

`@maytes/checkout-button` renders a "Split with Maytes" button. On click it calls the merchant's `createCheckout`, which asks the merchant's own server for a Maytes checkout, then opens the Maytes-hosted checkout in a popup (desktop) or the same tab (phones, blocked popups, `mode: 'redirect'`). The merchant's server captures the payment when Maytes sends the `checkout.authorized` webhook.

## Non-negotiables

1. **Secrets stay on the server.** The Maytes client id and secret are used only by the merchant's backend. The browser calls the merchant's own endpoint (for example `POST /api/maytes/checkout`), never the Maytes API.
2. **`createCheckout` resolves to `{ checkoutId, checkoutUrl? }`.** The merchant API answers in snake_case (`checkout_uuid`, `checkout_url`); the server maps them to `checkoutId` and `checkoutUrl`. Return `checkoutUrl` whenever the API gives one.
3. **Price on the server.** The browser sends a cart or order reference, never a total.
4. **One instance per mount, destroyed on unmount.** Create the instance in the framework's mount hook and call `destroy()` in its cleanup. Under React StrictMode the effect runs twice in development; returning `() => maytes.destroy()` keeps exactly one button.
5. **No `window` during server rendering.** Create the instance only in browser-only lifecycle code: `useEffect`, `onMounted`, `onMount`, or `ngAfterViewInit` guarded by `isPlatformBrowser`. Importing the package is safe on the server.
6. **Read the latest cart at click time.** `createCheckout` runs on click, so read the cart from a ref, prop getter or store, not a value captured when the instance was created. Don't rebuild the button when the cart changes.
7. **Matching environments.** `environment: 'sandbox'` with sandbox API credentials (`https://sandbox-api.maytes.co`), `'production'` with production credentials (`https://api.maytes.co`).
8. **Payment is confirmed by the server.** Capture on `checkout.authorized` within 2 minutes. The shopper landing on `return_url` is not proof of payment.

## Released API (the only API to use)

- `Maytes(options, internal)` creates an instance. `options` takes `createCheckout` and `environment`; the optional `internal` argument takes `cspNonce` for strict style CSPs.
- `renderButton(container, { label, block, mode })` renders the button and returns a function that removes it. `mode` is `'popup'` (default) or `'redirect'`.
- `redirectToCheckout({ checkoutId, replace })` and `checkoutUrl({ checkoutId })` work with a checkout that already exists.
- `destroy()` tears down the instance.
- Events on `document`: `maytes:checkout-opened`, `maytes:checkout-closed`, `maytes:checkout-redirected` (detail `CheckoutRedirectedDetail`), `maytes:checkout-failed` (detail `CheckoutFailedDetail`).
- Types: `MaytesSDK`, `MaytesOptions`, `RenderButtonOptions`, `CheckoutRedirectedDetail`, `CheckoutFailedDetail`; errors: `MaytesError`.

Never invent options, methods or events beyond this list. If the user wants something the list doesn't offer, say so instead of guessing.

## Pick the stack

| The checkout page is built with | Read |
|---|---|
| Server-rendered HTML or any page without a bundler | [references/html.md](references/html.md) |
| A bundler without a UI framework | [references/npm.md](references/npm.md) |
| React | [references/react.md](references/react.md) |
| Next.js | [references/nextjs.md](references/nextjs.md) |
| Vue 3 or Nuxt 3 | [references/vue-nuxt.md](references/vue-nuxt.md) |
| Angular | [references/angular.md](references/angular.md) |
| Svelte or SvelteKit | [references/svelte.md](references/svelte.md) |
| Solid or SolidStart | [references/solid.md](references/solid.md) |
| The merchant's backend, any language | [references/server.md](references/server.md) |
| A checkout that uses Stripe's Payment Element | [references/stripe.md](references/stripe.md) |

Always do the server part too ([references/server.md](references/server.md)): the button does nothing useful without the endpoint and the webhook.

## Verify before you finish

- [ ] No Maytes credential appears in any browser file, environment variable exposed to the client (`NEXT_PUBLIC_`, `VITE_`, `PUBLIC_`) or bundle.
- [ ] The endpoint returns `{ checkoutId, checkoutUrl }` and prices the cart on the server.
- [ ] The instance is created in browser-only lifecycle code and `destroy()` runs on unmount; in React, development mode shows one button, not two.
- [ ] `environment` matches the credentials the server uses.
- [ ] A webhook route verifies `X-Maytes-Signature` and captures on `checkout.authorized`.
- [ ] Clicking the button in sandbox opens the Maytes checkout (popup on desktop, same tab on a phone-width window).
- [ ] If the site sets a CSP: `script-src` allows `https://js.maytes.co` when loading from the CDN, a policy that restricts connections allows it in `connect-src`, and a strict `style-src` passes `cspNonce`.

Full guides: https://github.com/kttipay/maytes-checkout-button#readme and https://developers.maytes.co/checkout-button
