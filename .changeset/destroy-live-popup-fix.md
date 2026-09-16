---
"@maytes/checkout-button": patch
---

`destroy()` no longer force-closes a popup that has already navigated to the checkout URL. Previously it would close any open popup unconditionally, which could kill an in-progress checkout if the host page called `destroy()` while the popup was still completing (e.g. reacting to its own payment-status polling). A popup is now only auto-closed while it's still on the blank loading screen, before checkout has started.
