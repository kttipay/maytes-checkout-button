---
'@maytes/checkout-button': major
---

First public release on npm.

The button is now installable as `@maytes/checkout-button` alongside the existing
CDN `<script>` distribution — same package, same API, both fed from this source.

Framework apps (React, Angular, Vue, Svelte, plain bundled JS) should import the
factory directly:

```ts
import { Maytes } from '@maytes/checkout-button';
```

That removes the script-injection dance those apps previously needed: no
`window.Maytes` global to feature-detect, no polling for the CDN script to
finish loading before mounting, and no hand-written `declare global` typings —
the package ships its own `.d.ts`.

The `<script>` tag remains the right integration for no-build sites and jQuery,
and is unchanged: pin a SemVer or content-hash URL with SRI in every environment,
development included.
