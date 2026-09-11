# Why this repo is the real source, not a mirror

> Decision record. This repo used to be a release-only mirror of `checkout-button/` inside the private `kttipay/checkout-web` monorepo. It's the real source now — this is why.

The first `@maytes/checkout-button@1.0.0` publish attempt failed:

```
npm error 422 Unprocessable Entity - Error verifying sigstore provenance bundle:
Unsupported GitHub Actions source repository visibility: "private".
```

npm's registry has required a public source repository for provenance since July 2023 — a permanent registry policy, not a token, permission, or billing-plan issue. No paid GitHub or npm plan restores provenance for a private source repo (checked directly: GitHub Enterprise Cloud unlocks a *different*, GitHub-native attestation system that npm's registry doesn't check against `npm publish --provenance`).

Rather than disable provenance and keep the source in the private monorepo, the SDK's source moved here. That also permanently fixes a trade-off the old mirror setup carried — a mirrored `CHANGELOG.md` whose PR/commit links pointed at the private repo and 404'd for public viewers — and removes an entire layer of mirroring machinery (there's nothing left to mirror; this repo *is* the release).
