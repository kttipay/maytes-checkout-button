# Checkout button — CDN versioning & distribution strategy

> Decision record + reasoning. Captures the recurring question of how merchants consume the SDK from the CDN: development evergreen vs production pins, and pinned files named by content-hash vs SemVer (e.g. `js.maytes.co/v1.0.0/checkout-button.js`).

**Current scheme (the conclusion):** production is recommended to use the evergreen major channel (`js.maytes.co/v1/checkout-button.js`); pinning by SemVer (`js.maytes.co/v1.0.0/checkout-button.js`) or content hash (`js.maytes.co/checkout-button.<sha256>.js`), both protected with SRI, remains fully supported for merchants who want it. `js.maytes.co/dev/checkout-button.js` is a rolling, short-cached channel for development and staging only. See "Revisited again" below for why the recommendation changed from pin-by-default. The rest of this doc is the reasoning behind all of it, including the reasoning this later revision moved away from.

## Two independent axes

1. **Channel** — a three-way choice: the development-only rolling `/dev/`, the evergreen production channel `/v<major>/` (the recommendation as of the second revision below), or an exact production pin.
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

**Conclusion:** for a redirect/UI button, **pin by default**; keep a rolling channel as opt-in for merchants who want auto-updates.

## Why hash beats semver — *only on a self-hosted CDN*

A content-hash filename is immutable **by construction** (the name is derived from the bytes). A semver name is immutable only **by policy**. npm enforces that policy (a published version can never be re-uploaded), so npm-backed CDNs (jsDelivr / unpkg) get semver-immutability for free. Our self-hosted `js.maytes.co` does not — which is the only reason we hash there.

## Recommendation (superseded by "Revisited again" below — kept for history)

- **Default for production: pinned + SRI** — `https://js.maytes.co/v1.0.0/checkout-button.js` or `https://js.maytes.co/checkout-button.<sha256>.js`. Stable for the merchant, caches a year, and can be protected with SRI. The merchant picks a version from the release notes, which map each version to its SemVer path, hashed file, and SRI.
  - **Hash remains the strongest byte-level pin.** The hash is a fingerprint of the bytes, so the URL can never silently serve different code. The SemVer path is a readable release pin and must be used with SRI.
- **Development-only rolling channel** — `https://js.maytes.co/dev/checkout-button.js` (short cache) for internal dev/staging and merchant test environments that explicitly want auto-updates. Do not use it in production.
- **Opt-in evergreen for production (added 2026-09-18)** — `https://js.maytes.co/v1/checkout-button.js` (no SRI possible, ~5 min cache), for merchants who explicitly want to trade the pin-safety guarantee for automatic updates within a major version. Not the default, not promoted as the primary integration path, and — see "Revisited" below — **not a substitute for shipping fixes promptly to pinned merchants.**
- **Semver stays the human source of truth** — npm version, changelog, GitHub Releases — each mapped to its hashed file + SRI.

**As of "Revisited again" below, this ordering is inverted: evergreen (`/v1/`) is the recommendation, pinning is offered as the safety-first alternative.** Left unedited above so the "design, not payment" reasoning that originally produced it stays legible.

### Back pocket: a readable semver URL, if ever wanted

If a human-readable pinned URL is preferred over a hash, the zero-infra path is to let **jsDelivr/unpkg serve our npm package**:

```
https://cdn.jsdelivr.net/npm/@maytes/checkout-button@1.0.0/dist/checkout-button.js
```

It's semver, **immutable for free** (npm forbids re-publishing a version), and SRI-able — the same guarantee a self-hosted `…-0.1.0.js` would *not* have. The reason Adyen/Braintree/unpkg can safely put a version in the URL is precisely that they're npm-backed; our self-hosted CDN isn't, which is why we hash there.

## Revisited (2026-09-18): an opt-in `/v1/` was added

The reasoning above still holds as the *default*: this SDK doesn't touch card data, so it doesn't inherit Stripe's hot-patch constraint, and pinning remains correct for merchants who don't ask for anything else.

What changed: there's demand for an auto-updating option from merchants who'd rather take the auto-update trade explicitly. Two things worth being explicit about, because the first draft of this change conflated them:

- **This does not solve "we shipped a bug and want every merchant fixed right now."** Merchants who already have a bad build are pinned to a specific SemVer or hash URL — `/v1/` doesn't exist for them until they change their `<script>` tag, and changing it to `/v1/` is no faster than changing it to the next pinned version. An urgent fix still ships the way it always did: cut a patch release, tell pinned merchants to bump.
- **`/v1/` reintroduces the exact blast-radius risk this doc warns about, for whoever opts in.** A bad release on `/v1/` reaches every merchant on it simultaneously, with no per-merchant rollback, the same failure mode Adyen/Braintree-style pinning was chosen to avoid. It's offered as an explicit, documented trade a merchant can choose — not as a safer default, and not as an incident-response tool.

See `docs/cdn-pin-durability-and-evergreen-v1.md` for the implementation design, including the mechanism that makes `/v1/` (and, incidentally, every historical SemVer/hash pin) survive across future releases.

## Revisited again (2026-09-18): evergreen promoted to the recommendation

The section above still holds as a description of the trade-off — it hasn't changed. What changed is which side of it the team chose to lead with: **`/v1/` is now the recommended integration path**, with pinning offered as the alternative for merchants who want to freeze on a tested build.

Be precise about what this decision is and isn't:

- **The blast-radius argument above is not wrong, and wasn't re-litigated with a new fact about the SDK.** This SDK still doesn't touch card data in-browser, so it still doesn't inherit Stripe's actual hot-patch constraint — nothing changed on that front. The team weighed that risk against wanting merchants to get updates by default, without each one having to separately notice a release and bump a pin, and chose update-velocity.
- **This still isn't a hot-fix mechanism** for merchants already on a pinned URL — see the bullets in "Revisited" above; they're unaffected by which option is *recommended* to new integrators.
- **The mitigations this doc already argued for still apply and matter more now, not less:** pin durability (every SemVer/hash pin surviving forever, per `docs/cdn-pin-durability-and-evergreen-v1.md`) so pinning stays a genuine, easy fallback; and merchants who want to reduce evergreen's blast radius themselves can poll `https://js.maytes.co/integrity.json` and alert on unexpected changes, per the README's evergreen section.

## Status

- **Implemented:** IIFE minification; the rolling `/dev/` channel, self-hosted SemVer aliases, hashed files, SRI generation, and the evergreen `/v1/` channel with durable historical pins all exist.
- **Decision:** production is recommended to use `/v1/` evergreen. Pinned SemVer or hash URLs with SRI remain fully supported and are the documented fallback for merchants who prioritize pin-safety over auto-updates.
- **Caveat to honour:** if card fields ever move in-browser, this SDK would inherit Stripe's actual hot-patch constraint — at that point evergreen stops being just a convenience choice and becomes closer to a requirement, the same way it is for Stripe.
