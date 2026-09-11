---
"@maytes/checkout-button": patch
---

Harden the checkout button popup lifecycle:

- Open the hosted checkout URL exactly once (it was navigated twice — `window.open(url)` plus a redundant `location.href` write).
- Give each SDK instance a unique popup window name so concurrent merchant tabs no longer share or steal one popup; this also removes the cross-origin `SecurityError` that could hang the overlay.
- `destroy()` now detaches every button's click listener and is ignored by an in-flight `createCheckout` that resolves after teardown (no late popup).
- Remove the cloned overlay `<style>` from the top document on teardown (same-origin iframe embeds).
- Scope the injected style marker and ref-count by SDK version so two SDK versions on one page don't clash.
- Clear the overlay immediately when the shopper presses Escape (was delayed up to one poll interval).
- Validate that a merchant-supplied `checkoutUrl` is an `http(s)` URL before opening it — matching the protocol guard already applied to the constructed URL, so a buggy backend can't turn the button into a `javascript:`/`data:` popup.
