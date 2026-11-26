---
'@maytes/checkout-button': patch
---

The first time a button is on screen on a page in production, the SDK now requests an empty file from `js.maytes.co`, so Maytes can count how often buttons are shown on each site. The request carries your site's origin, not the page address, and no cookies or shopper identifiers. If your Content Security Policy restricts connections, allow `https://js.maytes.co`.
