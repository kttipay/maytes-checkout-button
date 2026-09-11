---
"@maytes/checkout-button": minor
---

Add a launch `mode` to `renderButton` and a branded popup loading screen.

- `renderButton(container, { mode })` accepts `'redirect'` (new default) or `'popup'`. Invalid values throw `MaytesError(CONFIG)`.
- `mode: 'popup'` opens a blank popup synchronously on click (preserving the user gesture so browsers do not block it), paints a branded Maytes loading screen into it (logo, spinner, `role="status"`/`aria-live`, a slow-network message that appears after ~8s, and a `prefers-reduced-motion` guard), then `popup.location.replace(url)`s once `createCheckout` resolves.
- On mobile viewports `mode: 'popup'` behaves as a same-window redirect.
- The misleading `maytes:checkout-failed` (`reason: 'popup-blocked'`) is replaced by a new `maytes:checkout-redirected` event (`detail.url`). A same-window redirect is a normal outcome, not a failure. The `failed` event now only carries `'create-checkout-rejected'` | `'invalid-shape'`.
- A popup opened before `createCheckout` resolves is now closed if the call rejects, returns an invalid shape, or the instance is destroyed mid-flight. `destroy()` also closes any open popup.
- Exported `POPUP_LOADING_CSS` for the loader stylesheet.
