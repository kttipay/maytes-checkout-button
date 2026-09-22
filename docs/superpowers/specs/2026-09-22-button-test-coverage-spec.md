# Checkout Button — Full Test Coverage & Testability Spec

Status: draft, awaiting review
Scope: `src/` (the button SDK itself — `button.ts`, `maytes.ts`, `overlay.ts`, `redirect.ts`, `state.ts`, `styles.ts`, `env.ts`, `errors.ts`, `branding.ts`) and the CI gates that run those tests before a release. Out of scope: CDN/release tooling under `scripts/` (`cdn-config.mjs`, `changelog.mjs`, `readme.mjs`, `hash-and-sri.mjs`) — those already have their own dedicated test files (`cdn-config.test.ts`, `changelog.test.ts`, `readme.test.ts`, `foundation.test.ts`) and are a separate concern from button behavior.

## 1. Current state

`npm run test:run` today: **136 tests, 10 files, all green.**

| File | Tests | Covers |
|---|---|---|
| `button.test.ts` | 56 | render → click → `createCheckout` → redirect/popup, busy gating, popup lifecycle, events, destroy/cleanup, style refcounting |
| `env.test.ts` | 24 | `isValidEnvironment`, `resolveBaseUrl` |
| `init.test.ts` | 9 | `Maytes()` factory validation |
| `redirect.test.ts` | 10 | `checkoutUrl`, `redirectToCheckout` |
| `errors.test.ts` | 8 | `MaytesError` shape |
| `overlay.test.ts` | 4 | overlay host resolution (same-frame / cross-frame / SecurityError) |
| `cdn-config.test.ts`, `changelog.test.ts`, `readme.test.ts`, `foundation.test.ts` | 25 | release tooling, not button behavior (out of scope here) |

This is a strong baseline — the `button.test.ts` suite in particular already drives real click → async → DOM assertions rather than mocking internals, and every documented behavior contract in `docs/overview.md` §"Behaviour contracts" has at least one test. The gaps below are the remaining edges, not a rewrite.

Two things are true independent of test *content*, and matter for "test before every release":
- There is no coverage measurement at all — no `@vitest/coverage-v8` (or similar) in `devDependencies`, no `coverage` block in `vitest.config.ts`, no coverage script in `package.json`.
- `.github/workflows/release.yml`'s `release` job (triggered on every push to `main`) runs `changesets/action` → `npm run version` (build) → `npm run release` (build + publish) **without running `typecheck` or `test:run` first**. It currently trusts that `pr.yml` already gated the merge. If a push ever reaches `main` without going through a green PR (a bad merge, a branch-protection misconfiguration, a manual push), the release workflow will publish and deploy untested code. `pr.yml` is a merge gate; it is not a release gate.

## 2. New test cases to add

Grouped by file. Each is a gap versus current behavior in the source, not a hypothetical.

### `button.test.ts`

1. **Icon swap during busy lifecycle.** No test currently asserts the button's own icon element — `setBusy` (`src/button.ts:185-197`) replaces `.maytes-checkout-button__logo` with `.maytes-checkout-button__spinner` on busy, and back on idle. Add a test that clicks, asserts the spinner is present and the logo is gone while busy, then (on rejection or popup-close) asserts the logo is back and the spinner is gone.
2. **Mobile viewport boundary.** `isMobileViewport()` (`src/button.ts:87-89`) uses `innerWidth <= 600`. Existing test uses `390` (well inside mobile). Add boundary tests at exactly `600` (mobile) and `601` (desktop/popup).
3. **`refocusPopup` swallows only `SecurityError`.** (`src/button.ts:45-49`) Add a test where `popup.focus()` throws a non-`SecurityError` (e.g. a plain `Error`) and assert it propagates instead of being swallowed — this is a real branch (`if (!isSecurityError(err)) throw err;`) with no coverage today.
4. **`closePopupWindow` and `stopPopupPoll` as standalone units.** Both are exported from `button.ts` but only exercised indirectly through `renderButton`. Add direct unit tests: `closePopupWindow(null)` is a no-op; `closePopupWindow(popup)` calls `.close()` only if not already closed; `closePopupWindow` swallows `SecurityError` from `.closed`/`.close()` access but rethrows other errors; `stopPopupPoll` clears the interval and nulls the handle, and is a no-op when already null.
5. **`popupFeatures()` centering math with and without `window.screen`.** (`src/button.ts:60-66`) Add a test that stubs `window.screen` to `undefined` and asserts the fallback (`POPUP_WIDTH`/`POPUP_HEIGHT`) is used for centering instead of throwing.

### `state.ts` (new file: `src/test/state.test.ts` — currently has zero direct tests)

6. **`generatePopupName()` fallback path.** (`src/state.ts:19-28`) When `crypto.randomUUID` is unavailable or throws, the name still falls back to `maytes-checkout-<timestamp>-<random>`. Today this is only exercised through the `crypto.randomUUID` happy path (implicitly, via jsdom having `crypto`). Add tests that stub `crypto.randomUUID` as `undefined` and as throwing, asserting the fallback format and uniqueness across two calls.
7. **`createInstanceState` config passthrough.** Direct unit test (no `Maytes()` factory involved) that `internal.baseUrl`/`internal.cspNonce` are copied onto `config` only when defined, and initial state fields (`busy: false`, `destroyed: false`, `popupWindow: null`, `teardowns` empty `Set`) are as documented.

### `redirect.ts`

8. **`isHttpUrl` direct unit tests.** Exported but currently only exercised indirectly (via the `javascript:` rejection test in `button.test.ts`). Add direct cases: `https://…` → true, `http://…` → true, `javascript:alert(1)` → false, `data:text/html,…` → false, a malformed string (`not a url`) → false (no throw).

### `overlay.ts`

9. **Re-show guard.** (`src/overlay.ts:93-94`, `if (state.overlayEl !== null) return;`) Calling `showOverlay(state)` twice in a row must not create a second `<dialog>`. No current test covers this.
10. **`showModal` failure fallback.** (`src/overlay.ts:100-111`) Stub `HTMLDialogElement.prototype.showModal` to throw and assert the code falls back to `setAttribute('open', '')` + inline backdrop background, instead of leaving the dialog un-shown.
11. **`showModal` unavailable (not a function).** Same fallback path, different trigger — `typeof dialog.showModal !== 'function'`. jsdom's `<dialog>` may or may not implement `showModal`; if it does, this branch needs an explicit stub (delete/override the method) to exercise deterministically.
12. **"Return to Maytes" link.** (`src/overlay.ts:65-76`) Clicking the link while `state.popupWindow` is open and not closed calls `popup.focus()`; clicking it when the popup is already closed or null is a no-op (no throw).
13. **`ensureOverlayStylesInTopDocument` dedup.** (`src/overlay.ts:25-36`) Calling `showOverlay` → `hideOverlay` → `showOverlay` again against the same cross-frame host should not duplicate the cloned `<style>` (or should re-clone cleanly) — pin down and test whichever is the intended behavior.
14. **`hideOverlay` removes the cloned cross-frame style.** Current `overlay.test.ts` manually cleans up the cloned style in `afterEach` rather than asserting `hideOverlay` itself removes it (`src/overlay.ts:114-124`, `host.head.querySelector(...)?.remove()`). Add a test that calls `showOverlay` then `hideOverlay` against a cross-frame host and asserts the cloned style is gone afterward, without the manual cleanup standing in for the assertion.

### `styles.ts`

15. **Direct ref-count unit tests.** Currently only exercised through `renderButton`/`destroy` cycles. Add direct tests against `ensureStylesInjected`/`releaseStyles` (no button/DOM involved): first call injects the `<style>`, N calls only inject once, releasing back to zero removes it, releasing below zero is clamped (never goes negative), and `resetStylesForTests()` fully resets ref-count and DOM state.

### `branding.ts` (new file: `src/test/branding.test.ts` — currently zero direct tests)

16. **`buildMaytesLogo` contract.** Low priority, but it's public and reused in two places (button + overlay + popup loading screen). One test locking `viewBox`, `xmlns`, that `height`/`color` map to `style.height`/`style.color`, and that the path count matches `MAYTES_LOGO_PATHS.length` — protects against an accidental change silently breaking the rendered mark in all three call sites at once.

Total new tests: **~28-32** depending on how some are split (e.g. #10/#11 could be one test or two). This is additive — nothing above requires deleting an existing test.

## 3. Refactor / testability cleanup

Ranked by value; none of these are required to add the tests above (all 16 gaps can be tested against the code as it stands today), but each removes friction for whoever writes the next test or the next feature.

1. **Extract the fake-`window.location` fixture into a shared test helper.** `button.test.ts` (`beforeEach`, ~20 lines) and `redirect.test.ts` (`beforeEach`, ~15 lines) each redefine `window.location` with an identical `href`-getter/setter + `assignSpy`/`replaceSpy` pattern. Extract to `src/test/helpers/fake-location.ts` exporting something like `installFakeLocation(): { assignSpy, replaceSpy, restore }`, used with `beforeEach`/`afterEach` in both files. Pure duplication removal — same behavior, one source of truth.
2. **Extract `makeFakePopup()` into the same helpers module.** It's currently private to `button.test.ts`. Moving it to `src/test/helpers/fake-popup.ts` costs nothing today and means the new `state.test.ts` / any future popup-adjacent test doesn't reinvent it or diverge from the shape `button.test.ts` relies on.
3. **Extract the repeated DOM-reset boilerplate.** Both `button.test.ts` and `overlay.test.ts` hand-roll `document.querySelectorAll('[data-maytes-overlay]').forEach((el) => el.remove())` plus `resetStylesForTests()` in `beforeEach`/`afterEach`. A single `resetMaytesDomForTests()` helper (co-located with the other test helpers, not in `src/`) keeps every future test file's setup one line instead of a copy-pasted block, and keeps the "what does a clean test start with" contract in one place.
4. **`handleClick` in `button.ts` (`:232-282`) does five things in one closure:** busy-gate, popup pre-open, await `createCheckout`, validate/resolve the URL, and dispatch the outcome (redirect vs popup-navigate vs failed). It's already broken into named helper closures (`teardownActiveCheckout`, `dispatchFailed`, `dispatchRedirected`, `redirectSameWindow`, `closeOrphanPopup`) which is good — the remaining opportunity is that **outcome resolution** (turn a `createCheckout` settlement into one of "redirect", "navigate popup", or "failed") is inline in the `try`/`catch` rather than a named, independently testable step. This is a nice-to-have, not a blocker: recommend deferring it unless a future feature (e.g. a new outcome branch) actually needs the seam. Flagging it here so it doesn't get missed if `button.ts` grows further.
5. **No dependency injection for `window`/`screen`/`crypto` globals.** Tests today mutate real globals (`window.innerWidth`, `window.screen`, `crypto.randomUUID`) and restore them in `finally`/`afterEach`. This works and is already the codebase's established pattern (see `button.test.ts`'s `innerWidth` mobile test) — recommend *keeping* this pattern rather than introducing an injectable-viewport abstraction purely for testability. Introducing seams the tests don't need yet would be speculative; the global-patch-and-restore pattern is proven, low-risk, and consistent with the rest of the suite.
6. **`docs/overview.md` "Testing" section is stale** (says "111 tests across 7 files"; actual is 136 across 10). Update the counts/table as part of this work so the doc stays trustworthy as a coverage cross-reference — this doc is what item §1 above was checked against.

Explicitly **not** recommending: splitting `button.ts` into multiple production modules (popup-controller / dom-builder / click-handler), or adding a DI container/config object for globals. The file is 299 lines, already decomposed into ~15 small top-level functions, and every branch in it is reachable and testable today via jsdom + the existing global-patch pattern (confirmed by walking every gap in §2 without needing a production-code seam). Restructuring it now would be refactoring for its own sake, not because a test in §2 requires it.

## 4. Test infrastructure: making "before every release" real

1. **Add coverage measurement.** Add `@vitest/coverage-v8` as a dev dependency, add a `coverage` block to `vitest.config.ts` (provider `v8`, reporters `text` + `lcov`, `src/**/*.ts` included, `src/test/**`, `src/foundation/**`, and `dist/**` excluded), and add `"test:coverage": "vitest run --coverage"` to `package.json`. Set an initial threshold (recommend **90% lines/statements/functions, 85% branches** for `src/*.ts` excluding `src/index.ts`'s `window.Maytes` assignment line and `src/version.ts`, which are trivial) — high enough to catch a regression, low enough not to fight the `performRedirect` `typeof window === 'undefined'` guard (`src/redirect.ts:50-55`) which can't be hit inside jsdom and should be annotated `/* c8 ignore next */` rather than chased with a fake non-browser environment.
2. **Wire coverage into `pr.yml`.** Add `npm run test:coverage` (replacing or alongside `npm run test:run`) so a coverage regression fails the PR, same place `typecheck`/`test:run`/`build`/`audit` already run.
3. **Close the release-gate gap in `release.yml`.** Add `typecheck` + `test:run` (or `test:coverage`) steps to the `release` job, **before** the `changesets/action` step, so a push to `main` that somehow bypassed a green PR still can't publish/deploy broken code. This is the concrete answer to "test before every release" — today only merges are gated, not releases.
4. **Shared test helpers module** (`src/test/helpers/`) per §3.1-§3.3 above — `fake-location.ts`, `fake-popup.ts`, `reset-dom.ts` — imported by every `*.test.ts` file that needs them, so the release-gate tests above are exercising one consistent set of fixtures rather than four slightly-diverged copies.

## 5. Out of scope (explicitly)

- `scripts/*.mjs` and their tests (`cdn-config.test.ts`, `changelog.test.ts`, `readme.test.ts`, `foundation.test.ts`) — these test CDN/release tooling, not the button, and already have their own coverage.
- Cross-browser/real-browser E2E (Playwright/Cypress) against a live popup/window — `docs/overview.md` already documents that end-to-end verification against a real sandbox checkout is manual (requires a merchant backend that can mint a real `checkoutId`). Nothing here proposes changing that; jsdom + stubbed `createCheckout` remains the right tool for exercising button *behavior*.
- Visual/CSS regression testing of `styles.ts`'s CSS strings beyond the existing "contains this rule" assertions.

## 6. Next step

This spec becomes an implementation plan (superpowers:writing-plans) with tasks ordered as: (a) test infrastructure first (coverage tooling + shared helpers, since later tasks use them), (b) new test cases per §2 grouped by file, (c) the two doc/CI updates in §3.6 and §4.2-§4.3. Each task should run `npm run test:run` (and once added, `npm run test:coverage`) green before moving to the next.

## 7. Review verification notes (2026-09-22)

Spot-checked this spec against the current source and CI files rather than taking it at face value. Every `src/*.ts:LINE` citation in §2 and §3 was verified to point at the code it describes (`button.ts:45-49/60-66/87-89/185-197/232-282`, `state.ts:19-28`, `overlay.ts:25-36/65-76/93-94/100-111/114-124`, `redirect.ts:50-55`), and the "no coverage tooling" / "`release.yml` never runs tests" claims in §1 and §4 were independently re-confirmed against `package.json`, `vitest.config.ts`, and `.github/workflows/release.yml`.

Two findings from that verification pass:

1. **§2 item #1 (icon swap) is not just a coverage gap — it's a confirmed live bug.** Reproduced directly: `renderButton` (`button.ts:181`) captures `logo` once as a `const` at button-construction time. `setBusy(true)` (`button.ts:190`) calls `logo.replaceWith(buildSpinner())` unconditionally. On the *first* busy cycle this works (the original `logo` node is still attached). `setBusy(false)` (`button.ts:194-195`) then replaces whatever is currently in the DOM with a **brand-new** `buildLogo()` element — the closure's `logo` variable still points at the now-detached original node. On the *second* (and every subsequent) `setBusy(true)` call, `logo.replaceWith(buildSpinner())` runs on that detached node; per the DOM spec, `ChildNode.replaceWith()` on a node with no parent is a silent no-op. Net effect: **the busy spinner only ever appears on a button's first checkout attempt.** Any retry (failed `createCheckout`, a second sequential checkout on the same rendered button, etc.) leaves the Maytes logo visibly in place while `aria-busy`/`aria-disabled` are still correctly set underneath it — a real, user-facing regression, not a jsdom artifact (`ChildNode.replaceWith` is standard DOM behavior in every browser). Verified with a throwaway repro test (written, run, deleted — not committed): clicking, letting `createCheckout` reject, then clicking again shows no `.maytes-checkout-button__spinner` in the DOM on the second click. **Recommend re-scoping item #1 from "add a test" to "fix `setBusy`'s icon-tracking (e.g. track the current indicator via a mutable reference or always re-query, not a `const` closure), then add the regression test."** This should be the first task in the implementation plan, not just another item in the list — it's the one gap in this spec that's an actual bug, not a missing assertion.
2. **§2 item #11 (`showModal` not a function) is already implicitly exercised today, just never asserted.** Confirmed jsdom 25.0.1 (the project's test-environment version) does not implement `HTMLDialogElement.prototype.showModal` at all (`typeof dialog.showModal === 'function'` is `false` out of the box) — so *every* existing overlay-mounting test already runs through the `else` fallback branch (`overlay.ts:108-110`), it's just that nothing asserts the resulting `open` attribute / inline backdrop explicitly. Item #10 (`showModal` throwing) is the one that needs a deliberate stub — jsdom has no native `showModal` to throw from, so a fake method has to be added to the prototype/instance first. Minor framing note only; doesn't change scope, just sharpens which of the two is "zero coverage" (#10) vs. "covered behavior, unasserted" (#11).

Everything else in the spec (test-case list, refactor recommendations, coverage-tooling and release-gate proposals) checked out as written — no other corrections.
