---
"@maytes/checkout-button": patch
---

Take the Maytes brand colours from the design foundation (`kttipay/designsystem` v0.3.0, vendored by `npm run sync:foundation` and pinned in `foundation.lock.json`) instead of hand-written hexes. The only rendered change: the button's hover shade is now the foundation's burgundy/700 `#3B021D` (was `#3A021C`).
