# Changelog

## 1.0.1

### Patch Changes

- [#2](https://github.com/kttipay/maytes-checkout-button/pull/2) [`e5b8e63`](https://github.com/kttipay/maytes-checkout-button/commit/e5b8e6399dd33e0b3b24131d9f808ebd8eae44ef) Thanks [@kos-maytes](https://github.com/kos-maytes)! - `destroy()` no longer force-closes a popup that has already navigated to the checkout URL. Previously it would close any open popup unconditionally, which could kill an in-progress checkout if the host page called `destroy()` while the popup was still completing (e.g. reacting to its own payment-status polling). A popup is now only auto-closed while it's still on the blank loading screen, before checkout has started.

<!-- @hash-sri-start -->

**SRI hashes** (use these in `<script integrity="..." crossorigin="anonymous">`):

```
checkout-button.js   sha384-scp0qo7rcOJGuuI+gpadCOUQMn7g7hx3lqY9p7Xr2fd7/9Sb/L79DaHKStTTX7Ko
checkout-button.mjs  sha384-5+TplHKGAk10ajWGdKwpG3pKutLD+v3cOYqtPEvRNLWudyOELPUKuU6sqlAhuy1h
checkout-button.cjs  sha384-+O2S6KfO4Pc0VEvL+kTsFzxU14W4EILV6+U5mAdW8X43Xm8Qk1aV0y/KbM3Fnp9M
```

**SemVer CDN links** (readable production pins; use with the SRI hashes above):

- [checkout-button.js](https://js.maytes.co/v1.0.1/checkout-button.js)
- [checkout-button.mjs](https://js.maytes.co/v1.0.1/checkout-button.mjs)
- [checkout-button.cjs](https://js.maytes.co/v1.0.1/checkout-button.cjs)

**Hashed CDN links** (byte-level production pins; use with the SRI hashes above):

- [checkout-button.8c71493e.js](https://js.maytes.co/checkout-button.8c71493e.js)
- [checkout-button.81ea2037.mjs](https://js.maytes.co/checkout-button.81ea2037.mjs)
- [checkout-button.6d259930.cjs](https://js.maytes.co/checkout-button.6d259930.cjs)

<!-- @hash-sri-end -->
## 1.0.0

First public release on npm.

### Major Changes

- **`@maytes/checkout-button` is now installable via npm**, alongside the existing CDN `<script>` distribution — same package, same API, both built from this repo.

  Framework apps (React, Angular, Vue, Svelte, plain bundled JS) should import the factory directly:

  ```ts
  import { Maytes } from "@maytes/checkout-button";
  ```

  That removes the script-injection dance those apps previously needed: no `window.Maytes` global to feature-detect, no polling for the CDN script to finish loading before mounting, and no hand-written `declare global` typings — the package ships its own `.d.ts`.

  The `<script>` tag remains the right integration for no-build sites and jQuery, and is unchanged: pin a SemVer or content-hash URL with SRI in every environment, development included.

### Minor Changes

- Branded the checkout button with the Maytes wordmark logo and maroon brand colour, and made its size auto-scale from a single `--maytes-button-font-size` custom property (default 14px).

- Added a launch `mode` to `renderButton` and a branded popup loading screen.

  - `renderButton(container, { mode })` accepts `'redirect'` (default) or `'popup'`. Invalid values throw `MaytesError(CONFIG)`.
  - `mode: 'popup'` opens a blank popup synchronously on click (preserving the user gesture so browsers do not block it), paints a branded Maytes loading screen into it (logo, spinner, `role="status"`/`aria-live`, a slow-network message that appears after ~8s, and a `prefers-reduced-motion` guard), then `popup.location.replace(url)`s once `createCheckout` resolves.
  - On mobile viewports `mode: 'popup'` behaves as a same-window redirect.
  - The misleading `maytes:checkout-failed` (`reason: 'popup-blocked'`) is replaced by a new `maytes:checkout-redirected` event (`detail.url`). A same-window redirect is a normal outcome, not a failure. The `failed` event now only carries `'create-checkout-rejected'` | `'invalid-shape'`.
  - A popup opened before `createCheckout` resolves is now closed if the call rejects, returns an invalid shape, or the instance is destroyed mid-flight. `destroy()` also closes any open popup.
  - Exported `POPUP_LOADING_CSS` for the loader stylesheet.

### Patch Changes

**Popup lifecycle**

- Open the hosted checkout URL exactly once (it was navigated twice — `window.open(url)` plus a redundant `location.href` write).
- Give each SDK instance a unique popup window name so concurrent merchant tabs no longer share or steal one popup; this also removes the cross-origin `SecurityError` that could hang the overlay.
- `destroy()` now detaches every button's click listener and is ignored by an in-flight `createCheckout` that resolves after teardown (no late popup).
- Remove the cloned overlay `<style>` from the top document on teardown (same-origin iframe embeds).
- Scope the injected style marker and ref-count by SDK version so two SDK versions on one page don't clash.
- Clear the overlay immediately when the shopper presses Escape (was delayed up to one poll interval).
- Validate that a merchant-supplied `checkoutUrl` is an `http(s)` URL before opening it — matching the protocol guard already applied to the constructed URL, so a buggy backend can't turn the button into a `javascript:`/`data:` popup.
- Fixed a race in `mode: 'popup'`: if the shopper closed the popup while `createCheckout` was still in flight, the SDK would try to navigate (or, on rejection, report a failure for) a window that was already gone once the promise settled — on top of the `maytes:checkout-closed` event the close-poll had already fired. Both the success and rejection paths now check whether the popup is still open before acting, so closing the popup early produces exactly one `checkout-closed` event and nothing else.

**Design & build**

- Brand colours now come from the design foundation (`kttipay/designsystem` v0.3.0, vendored by `npm run sync:foundation` and pinned in `foundation.lock.json`) instead of hand-written hexes. The only rendered change: the button's hover shade is now the foundation's burgundy/700 `#3B021D` (was `#3A021C`).
- The CDN (IIFE) bundle now ships minified, with a sourcemap. The ESM/CJS npm bundles stay unminified so the consumer's bundler can tree-shake them.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- @hash-sri-start -->

**SRI hashes** (use these in `<script integrity="..." crossorigin="anonymous">`):

```
checkout-button.js   sha384-dZQS1KceW5Q/UDS8qafQmJFIvORLSL/aNtpkbU94yqZCLB+ifJfxkgNLjHpFADkt
checkout-button.mjs  sha384-jQbytMpQ6WWb5T8Xd0+f8+B6QclSeIgF7AaYiVCe6UdXK6nYUoC/x+VM3YWTWxH1
checkout-button.cjs  sha384-XpEcs+bC2pKL1C8nhXv0sPSGWeWHGKrOnOJ/FGhseY0uIY6al831WIS+be4BQTIY
```

**SemVer CDN links** (readable production pins; use with the SRI hashes above):

- [checkout-button.js](https://js.maytes.co/v1.0.0/checkout-button.js)
- [checkout-button.mjs](https://js.maytes.co/v1.0.0/checkout-button.mjs)
- [checkout-button.cjs](https://js.maytes.co/v1.0.0/checkout-button.cjs)

**Hashed CDN links** (byte-level production pins; use with the SRI hashes above):

- [checkout-button.3cf081dc.js](https://js.maytes.co/checkout-button.3cf081dc.js)
- [checkout-button.5403f24b.mjs](https://js.maytes.co/checkout-button.5403f24b.mjs)
- [checkout-button.2a6f6a35.cjs](https://js.maytes.co/checkout-button.2a6f6a35.cjs)

<!-- @hash-sri-end -->
