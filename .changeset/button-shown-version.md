---
'@maytes/checkout-button': patch
---

The request that counts shown buttons now also carries the SDK version, for example `button-shown.txt?v=1.2.2`, so Maytes can see which versions are running. Nothing else about the request changes: still your site's origin only, no cookies and no shopper identifiers.
