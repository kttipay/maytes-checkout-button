---
---

Provision the `js.maytes.co/dev/*` Cloudflare Redirect Rule to the `dev` branch's Pages preview deployment, plus an explicit cache-bypass Cache Rule on the same path so nothing on the redirect path can be served stale. Re-applied on every `dev` push.
