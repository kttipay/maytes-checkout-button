---
---

Internal scaffolding only — no release. Adds CI/CD (PR checks + Changesets-driven release), npm-publish config (currently gated off via `private: true`), CDN deploy wiring, and `src/version.ts` generated from `package.json`. Flip `private: false` and add a real changeset when ready to publish.
