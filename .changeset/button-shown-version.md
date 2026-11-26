---
'@maytes/checkout-button': patch
---

The request that counts shown buttons now also carries the SDK version and the environment, for example `button-shown.txt?v=1.2.2&env=production`, so Maytes can see which versions are running and tell live traffic from test traffic. It is now sent from `sandbox` as well as `production`. Nothing else about the request changes: still your site's origin only, no cookies and no shopper identifiers. If your Content Security Policy restricts connections, `https://js.maytes.co` must be allowed in `sandbox` too.
