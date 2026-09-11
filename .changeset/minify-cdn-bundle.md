---
"@maytes/checkout-button": patch
---

Serve the CDN (IIFE) bundle minified, with a sourcemap. The ESM/CJS npm bundles stay unminified so the consumer's bundler can tree-shake them.
