---
"@maytes/checkout-button": minor
---

`renderButton`'s default `mode` is now `'popup'` instead of `'redirect'`. Pass `mode: 'redirect'` explicitly to keep the previous same-window navigation behavior. Popup mode already falls back to same-window redirect on mobile viewports and when the popup is blocked, so this only changes the desktop no-`mode`-specified path.
