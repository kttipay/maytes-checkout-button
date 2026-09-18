# Checkout button — CDN versioning & distribution strategy

> Decision record + reasoning. Captures the recurring question of how merchants consume the SDK from the CDN: development evergreen vs production pins, and pinned files named by content-hash vs SemVer (e.g. `js.maytes.co/v1.0.0/checkout-button.js`).

**Current scheme (the conclusion):** production is recommended to use the evergreen major channel (`js.maytes.co/v1/checkout-button.js`, no SRI possible); pinning by SemVer (`js.maytes.co/v1.0.0/checkout-button.js`) or content hash (`js.maytes.co/checkout-button.<sha256>.js`), both protected with SRI, remains fully supported for merchants who'd rather freeze on a tested build. `js.maytes.co/dev/checkout-button.js` tracks the `dev` git branch's live build, for internal pre-merge testing only — not a merchant channel. The rest of this doc is the reasoning the recommendation trades off, and why the team chose evergreen anyway.

## Two independent axes

1. **Channel** — a three-way choice: the internal-only `/dev/` (tracks the `dev` branch), the evergreen production channel `/v<major>/` (the recommendation), or an exact production pin.
2. **Pinned-file naming** — content-hash (`checkout-button.<sha256>.js`) vs semver (`checkout-button-0.1.0.js`).

## What others actually ship

| Category | Pattern | Examples |
|---|---|---|
| General JS libraries | **semver in URL** + `.min` + SRI (npm-immutable) | jQuery `jquery-3.7.1.min.js` · unpkg `react@18.2.0` · jsDelivr `lodash@4.17.21` · cdnjs |
| Payment SDKs — evergreen | major channel, **no version in URL**, no SRI | Stripe `js.stripe.com/v3/` · PayPal `/sdk/js` · Square `web.squarecdn.com/v1/square.js` |
| Payment SDKs — pinned | **semver in URL** + SRI | Adyen `…/sdk/5.x.x/adyen.js` · Braintree `js.braintreegateway.com/web/3.x.x/…min.js` |
| App build output | **content hash** | webpack / vite `main.4f2a9b.js` |

**Takeaway:** content-hash is the *app-build* convention; published *libraries* pin by **semver + SRI**; tier-1 *payments* split between evergreen (Stripe / Square / PayPal) and semver-pinned (Adyen / Braintree).

## Evergreen vs pin — and why this SDK is "design, not payment"

The case **for** evergreen is hot-patchability: an SDK that handles card data in the browser (Stripe.js) must be fixable on every merchant instantly, so Stripe forbids pinning. That's a real constraint — *for an SDK that touches card data.*

**This SDK doesn't.** The button renders UI and **redirects** to the Maytes-hosted checkout; card data and payment logic live on a separate app/origin, not in the bundle. So the hot-patch imperative is weak here, and the dominant risk flips: an evergreen release changes rendering/behaviour for **every merchant at once** (high blast radius), while pinning lets each merchant freeze on a known-good build. Adyen and Braintree — also payments — pin for exactly this reason.

**Cache reinforces pinning.** You can't invalidate browser caches; you cache-bust by changing the URL (which is why build tools hash filenames). An immutable pinned file caches a year and is "managed" by version bumps. Evergreen forces a *short* cache (≈5 min) — you give up real caching *and* a hot-fix still can't evict a copy already in someone's browser until its TTL lapses.

**This reasoning hasn't changed — the recommendation has.** The blast-radius and hot-patch arguments above are still true; the team weighed them against wanting merchants to get updates by default, without each one separately noticing a release and bumping a pin, and chose evergreen anyway. Pinning stays fully supported for merchants who'd rather have the guarantee this section describes.

## Why hash beats semver — *only on a self-hosted CDN*

A content-hash filename is immutable **by construction** (the name is derived from the bytes). A semver name is immutable only **by policy**. npm enforces that policy (a published version can never be re-uploaded), so npm-backed CDNs (jsDelivr / unpkg) get semver-immutability for free. Our self-hosted `js.maytes.co` does not — which is the only reason we hash there.

## Recommendation

- **Default for production: evergreen** — `https://js.maytes.co/v1/checkout-button.js` (no SRI possible, ~5 min cache). Always the newest `1.x` release; no per-merchant action needed to get an update. Not a hot-fix mechanism — a fix ships the same way either way (a new release) — and not a substitute for shipping fixes promptly to merchants who are pinned.
- **Pinned + SRI, for merchants who want the guarantee instead** — `https://js.maytes.co/v1.0.0/checkout-button.js` or `https://js.maytes.co/checkout-button.<sha256>.js`. Stable for the merchant, caches a year, protected with SRI. The merchant picks a version from the release notes, which map each version to its SemVer path, hashed file, and SRI.
  - **Hash remains the strongest byte-level pin.** The hash is a fingerprint of the bytes, so the URL can never silently serve different code. The SemVer path is a readable release pin and must be used with SRI.
- **Internal dev-branch channel** — `https://js.maytes.co/dev/checkout-button.js` mirrors the `dev` git branch's latest pushed build, deployed via a Cloudflare Pages preview (isolated from the production deployment). For pre-merge testing only, not for merchants; may be broken or mid-development at any time.
- **Semver stays the human source of truth** — npm version, changelog, GitHub Releases — each mapped to its hashed file + SRI.

### Back pocket: a readable semver URL, if ever wanted

If a human-readable pinned URL is preferred over a hash, the zero-infra path is to let **jsDelivr/unpkg serve our npm package**:

```
https://cdn.jsdelivr.net/npm/@maytes/checkout-button@1.0.0/dist/checkout-button.js
```

It's semver, **immutable for free** (npm forbids re-publishing a version), and SRI-able — the same guarantee a self-hosted `…-0.1.0.js` would *not* have. The reason Adyen/Braintree/unpkg can safely put a version in the URL is precisely that they're npm-backed; our self-hosted CDN isn't, which is why we hash there.

## Status

- **Implemented:** IIFE minification; the `dev`-branch `/dev/` channel, self-hosted SemVer aliases, hashed files, and SRI generation all exist.
- **Decision:** production is recommended to use `/v1/` evergreen. Pinned SemVer or hash URLs with SRI remain fully supported as the documented fallback for merchants who prioritize pin-safety over auto-updates.
- **Caveat to honour:** if card fields ever move in-browser, this SDK would inherit Stripe's actual hot-patch constraint — at that point evergreen stops being a convenience choice and becomes closer to a requirement, same as it is for Stripe.
