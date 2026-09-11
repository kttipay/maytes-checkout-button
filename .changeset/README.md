# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets). It versions and changelogs `@maytes/checkout-button`.

## Adding a change

Run from `checkout-button/`:

```bash
npm run changeset
```

Pick the bump (`patch` / `minor` / `major` — `major` for any breaking API change, like removing or renaming a public method) and write a human-readable summary. Commit the generated file in `.changeset/`.

## Releasing

You don't run the release by hand. On merge to `main`, the release workflow opens a **"Version Packages"** PR that consumes pending changesets, bumps `package.json` + `CHANGELOG.md`, and regenerates `src/version.ts`. Merging that PR publishes to npm (with provenance), deploys the bundle to the CDN, and cuts a GitHub Release.
