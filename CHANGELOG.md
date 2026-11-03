# Changelog

## 1.2.1

### Patch Changes

- [#39](https://github.com/kttipay/maytes-checkout-button/pull/39) [`73d1f0c`](https://github.com/kttipay/maytes-checkout-button/commit/73d1f0ccb84ec22473e8a0b1ba17e923c254e2ee) Thanks [@kos-maytes](https://github.com/kos-maytes)! - The Split with Maytes button keeps its white label and logo, burgundy background and Maytes focus ring when hovered, focused or pressed on sites whose theme styles every button (for example WooCommerce's Storefront theme, which turned the label dark grey on hover). Host-page transitions no longer fade the logo, and the overlay's "Return to Maytes" link no longer picks up the theme's button background. A mouse click no longer shows the theme's focus outline on the button or the link; keyboard focus shows the Maytes focus ring on both.

<!-- @hash-sri-start -->

**SRI hashes** (use these in `<script integrity="..." crossorigin="anonymous">`):

```
checkout-button.js   sha384-0n2iIhZMofbJkzlb2mgQmm714yMFWW0079cxvVxCxZKPjjRHTrEBddxLRygUFUA/
checkout-button.mjs  sha384-DvlD7lErx6rl9lPfEtS9tu9Hp+sb+LC8ZXkzCnfRxP2ruuHuE/toGraDj7Hp9KjU
checkout-button.cjs  sha384-2h9J+cURwjqOA8QYBgt1LeulM0IgD6w1hCxdLdieKvuhDb1/ejuXT3rLEy5SXsb9
checkout-button.element.js  sha384-NHwIzALKGM4v3zbs5kbpDmWb52EGQ6+NMh7ARB5UPTCbjwn3orJV1bDnXzgZrwck
```

**SemVer CDN links** (readable production pins; use with the SRI hashes above):

- [checkout-button.js](https://js.maytes.co/v1.2.1/checkout-button.js)
- [checkout-button.mjs](https://js.maytes.co/v1.2.1/checkout-button.mjs)
- [checkout-button.cjs](https://js.maytes.co/v1.2.1/checkout-button.cjs)
- [checkout-button.element.js](https://js.maytes.co/v1.2.1/checkout-button.element.js)

**Hashed CDN links** (byte-level production pins; use with the SRI hashes above):

- [checkout-button.299a037b.js](https://js.maytes.co/checkout-button.299a037b.js)
- [checkout-button.67fdb2e1.mjs](https://js.maytes.co/checkout-button.67fdb2e1.mjs)
- [checkout-button.332d26cc.cjs](https://js.maytes.co/checkout-button.332d26cc.cjs)
- [checkout-button.element.afe71cd5.js](https://js.maytes.co/checkout-button.element.afe71cd5.js)

<!-- @hash-sri-end -->
## 1.2.0

### Minor Changes

- [#28](https://github.com/kttipay/maytes-checkout-button/pull/28) [`a5c64cd`](https://github.com/kttipay/maytes-checkout-button/commit/a5c64cd13d095296c4c49eb3d9478f437802f9e3) Thanks [@kos-maytes](https://github.com/kos-maytes)! - `renderButton()` accepts `radius` and `height` so the Split with Maytes button can match an express-checkout row (for example 6px corners at 48px next to Apple Pay and Google Pay); a button with a `height` keeps its label on one line. Every `maytes:checkout-*` event now carries `detail.instanceId` and `detail.source` (`'button'` or `'api'`), and each instance exposes `maytes.instanceId`, so pages with several instances can tell their events apart. Existing event fields and the default button are unchanged: without `radius`/`height` the button renders exactly as in 1.1. Events that had no `detail` (`opened`, `closed`) now carry `{ instanceId, source }`. TypeScript code that hand-builds a `MaytesSDK` object needs the new `instanceId` member.

- [#30](https://github.com/kttipay/maytes-checkout-button/pull/30) [`ac332b7`](https://github.com/kttipay/maytes-checkout-button/commit/ac332b7bf5d361166484e1b657a1a303e22192ef) Thanks [@kos-maytes](https://github.com/kos-maytes)! - Add `<maytes-checkout-button>`, a standard custom element for any front-end stack (plain HTML, Vue/Nuxt, Angular, Svelte/SvelteKit, Solid, React 19). Import `@maytes/checkout-button/element` or load `https://js.maytes.co/v1/checkout-button.element.js`; set `environment` and the other options as attributes and `createCheckout` as a property, and listen for `maytes-opened`, `maytes-closed`, `maytes-redirected` and `maytes-failed` on the element. `open()` starts the checkout from your own button. Configuration mistakes arrive as `maytes-failed` with `reason: 'config'` instead of throwing. `checkout-button.js`, `.mjs` and `.cjs` are unchanged.

- [#26](https://github.com/kttipay/maytes-checkout-button/pull/26) [`92ef8c0`](https://github.com/kttipay/maytes-checkout-button/commit/92ef8c009fb74f7639be7e9cb1b2cd8d90a1c2ee) Thanks [@kos-maytes](https://github.com/kos-maytes)! - Add `openCheckout({ mode })` to start the Maytes checkout from the merchant's own button, with the same popup, loader, overlay, events and fallbacks as the rendered button. It resolves with the launch result (`popup`, `redirected`, `failed`, `closed` or `ignored`) and never rejects.

  No change for existing integrations: the rendered button looks and behaves exactly as before. TypeScript code that builds its own `MaytesSDK` object (for example a test fake) needs the new `openCheckout` member.

- [#29](https://github.com/kttipay/maytes-checkout-button/pull/29) [`c62fa53`](https://github.com/kttipay/maytes-checkout-button/commit/c62fa53eec701d71a84e67240ea86a6167aac4c0) Thanks [@kos-maytes](https://github.com/kos-maytes)! - Add React bindings at `@maytes/checkout-button/react` (`MaytesProvider`, `MaytesButton`, `useMaytes`) and `maytes.onBusyChange()`. React is an optional peer dependency (18 or 19); the CDN bundle is unchanged.

- [#36](https://github.com/kttipay/maytes-checkout-button/pull/36) [`59adae5`](https://github.com/kttipay/maytes-checkout-button/commit/59adae5dfdb72eb15f6ab4ad0174b9ac693e593f) Thanks [@kos-maytes](https://github.com/kos-maytes)! - `<MaytesButton>` accepts `redirectOverlay`, like `renderButton()`: with it, a same-tab launch shows the Maytes loading overlay while the checkout is created. Off by default.

- [#32](https://github.com/kttipay/maytes-checkout-button/pull/32) [`7634c62`](https://github.com/kttipay/maytes-checkout-button/commit/7634c62e007b56db63502322cd77fa553f7a14b5) Thanks [@kos-maytes](https://github.com/kos-maytes)! - Add an opt-in `redirectOverlay` option to `renderButton()` and `openCheckout()`: when the checkout opens in the same tab (redirect mode, phones, blocked popups), the Maytes loading overlay shows while the checkout is created and clears itself after a back-button return. Off by default, so existing integrations are unchanged.

### Patch Changes

- [#21](https://github.com/kttipay/maytes-checkout-button/pull/21) [`e87a44b`](https://github.com/kttipay/maytes-checkout-button/commit/e87a44b9649686048fa1e622831d601b8eeed71c) Thanks [@kos-maytes](https://github.com/kos-maytes)! - Fix the checkout button's busy-state spinner not reappearing after a customer's first checkout attempt on a given rendered button. The button now tracks its current icon (logo or spinner) by direct reference instead of re-querying the DOM by class name, so the spinner swap works correctly on every checkout attempt, not just the first.

<!-- @hash-sri-start -->

**SRI hashes** (use these in `<script integrity="..." crossorigin="anonymous">`):

```
checkout-button.js   sha384-gIQUOEPPO0H+Stb2Ffa40dFxBxGnB40p1+AHttEYor5oZiVKoM+aKagIL3GuNkG1
checkout-button.mjs  sha384-sKFZzp1oSiijC45OFR04FOjFQfgvxawtUp+u/qXvRu5s5ZF8iMSTHaQo5g+VLJ79
checkout-button.cjs  sha384-fkm1nIhsGYEjDw3uc4cjdxui4K8H4HuPnIQ379GP1Y7vtwFC/Dw3M85KopqvjRl1
checkout-button.element.js  sha384-Y3aDrAucY25r7DzSkYJpsjoazd67oBy4WSxbTXBgpaWaT6TOuEOW3PidCw0PeVb9
```

**SemVer CDN links** (readable production pins; use with the SRI hashes above):

- [checkout-button.js](https://js.maytes.co/v1.2.0/checkout-button.js)
- [checkout-button.mjs](https://js.maytes.co/v1.2.0/checkout-button.mjs)
- [checkout-button.cjs](https://js.maytes.co/v1.2.0/checkout-button.cjs)
- [checkout-button.element.js](https://js.maytes.co/v1.2.0/checkout-button.element.js)

**Hashed CDN links** (byte-level production pins; use with the SRI hashes above):

- [checkout-button.c640180e.js](https://js.maytes.co/checkout-button.c640180e.js)
- [checkout-button.d6e444ee.mjs](https://js.maytes.co/checkout-button.d6e444ee.mjs)
- [checkout-button.d7bc9aea.cjs](https://js.maytes.co/checkout-button.d7bc9aea.cjs)
- [checkout-button.element.6c530c24.js](https://js.maytes.co/checkout-button.element.6c530c24.js)

<!-- @hash-sri-end -->

## 1.1.1

### Patch Changes

- [#16](https://github.com/kttipay/maytes-checkout-button/pull/16) [`e0bd228`](https://github.com/kttipay/maytes-checkout-button/commit/e0bd228f454979c6dd41587cb0e82e9fe735a888) Thanks [@kttipaydiogocavaiar](https://github.com/kttipaydiogocavaiar)! - The popup loading overlay no longer outlives the frame that opened it. When the button runs inside a same-origin iframe, the "Completing checkout with Maytes…" dialog is mounted in the top-level document so it covers the whole merchant page, but only the frame's SDK instance could remove it. The hosted checkout's back, cancel and return exits navigate `window.opener`, which is that frame, so the frame's document was replaced, its popup poll died, and the merchant page stayed covered by a modal dialog with the button unreachable. The overlay now also listens for the frame's `pagehide` and removes itself from the top-level document when the frame navigates away.

<!-- @hash-sri-start -->

**SRI hashes** (use these in `<script integrity="..." crossorigin="anonymous">`):

```
checkout-button.js   sha384-dfHU/wrTbetBPk5TdX9haImZAq87uFVrlMKMSept0sgtIbTqdYWQi2ml8BF6Gq8N
checkout-button.mjs  sha384-JKjUqX0jqi7UoqqNYGlD97mTCeR0ZshbiLtXhfPQl2w5mQtfmBx+X7W95SjjmkkY
checkout-button.cjs  sha384-oSekYX0Re0jdMsBU6uzxUedTM+Cnl8uF5y0wmZmjUHngtzr8Sdze1MrOSYkGXKJ3
```

**SemVer CDN links** (readable production pins; use with the SRI hashes above):

- [checkout-button.js](https://js.maytes.co/v1.1.1/checkout-button.js)
- [checkout-button.mjs](https://js.maytes.co/v1.1.1/checkout-button.mjs)
- [checkout-button.cjs](https://js.maytes.co/v1.1.1/checkout-button.cjs)

**Hashed CDN links** (byte-level production pins; use with the SRI hashes above):

- [checkout-button.4b780d52.js](https://js.maytes.co/checkout-button.4b780d52.js)
- [checkout-button.aed57a66.mjs](https://js.maytes.co/checkout-button.aed57a66.mjs)
- [checkout-button.2aad12c3.cjs](https://js.maytes.co/checkout-button.2aad12c3.cjs)

<!-- @hash-sri-end -->

## 1.1.0

### Minor Changes

- [#11](https://github.com/kttipay/maytes-checkout-button/pull/11) [`def33e0`](https://github.com/kttipay/maytes-checkout-button/commit/def33e010bf23b11bc94871e236d35a65deb825e) Thanks [@kos-maytes](https://github.com/kos-maytes)! - `renderButton`'s default `mode` is now `'popup'` instead of `'redirect'`. Pass `mode: 'redirect'` explicitly to keep the previous same-window navigation behavior. Popup mode already falls back to same-window redirect on mobile viewports and when the popup is blocked, so this only changes the desktop no-`mode`-specified path.

- [#8](https://github.com/kttipay/maytes-checkout-button/pull/8) [`a6d85e2`](https://github.com/kttipay/maytes-checkout-button/commit/a6d85e23653e340b7a850ad61e882ec2f6cef5d2) Thanks [@kttipaydiogocavaiar](https://github.com/kttipaydiogocavaiar)! - The button never loads the hosted checkout inside an iframe any more. When the button is rendered inside a frame (for example a booking widget embedded on the merchant's page), a phone or a narrow frame used to take the same-window fallback and navigate the frame itself, so the checkout ran as a cross-site iframe where its session cookie is rejected and sign-in ended on "Your session expired". The button now measures the top-level window (or the screen when the top window is cross-origin) and navigates the top-level window; if the browser refuses, it opens the checkout in a new tab; if both are refused, it dispatches `maytes:checkout-failed` with `reason: 'navigation-blocked'` and leaves the button usable. `maytes:checkout-redirected` now carries `detail.target` (`'self' | 'top' | 'tab'`). `redirectToCheckout()` follows the same rule and throws `MaytesError` when it cannot leave the frame. Merchants who deliberately relied on in-frame navigation will see the top-level page change instead; render the button in the top-level page if that is not wanted.

<!-- @hash-sri-start -->

**SRI hashes** (use these in `<script integrity="..." crossorigin="anonymous">`):

```
checkout-button.js   sha384-+hQ9khxZbVEUhR685659hqmPyN/3RYfbNEI7itac3SkcyYor/94/0mIwVnVwMa8M
checkout-button.mjs  sha384-1areqNcTs9sephTl6S1+sOgACv1/NqIqXBG0Ej11/4OfSDcN92GvQvhhu4K76R5i
checkout-button.cjs  sha384-4c1JuweT47cnpvGlQfv+qQw/3CS+7o2/Dg4qQnLiWM1GDChhHQo0dT+z8705Hy50
```

**SemVer CDN links** (readable production pins; use with the SRI hashes above):

- [checkout-button.js](https://js.maytes.co/v1.1.0/checkout-button.js)
- [checkout-button.mjs](https://js.maytes.co/v1.1.0/checkout-button.mjs)
- [checkout-button.cjs](https://js.maytes.co/v1.1.0/checkout-button.cjs)

**Hashed CDN links** (byte-level production pins; use with the SRI hashes above):

- [checkout-button.811263f9.js](https://js.maytes.co/checkout-button.811263f9.js)
- [checkout-button.f96c49ee.mjs](https://js.maytes.co/checkout-button.f96c49ee.mjs)
- [checkout-button.178d8394.cjs](https://js.maytes.co/checkout-button.178d8394.cjs)

<!-- @hash-sri-end -->

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
