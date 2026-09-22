# Checkout Button — Full Test Coverage & Pre-Release Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every identified test gap in the `@maytes/checkout-button` SDK, fix the one real bug the gap analysis uncovered, and make "tests run before every release" literally true (today only PR merges are gated — releases are not).

**Architecture:** No production restructuring. One small, surgical bug fix in `button.ts` (a stale-closure icon reference). Everything else is additive: new test files/cases against the existing public + already-exported surface, a shared test-fixture helpers module to kill duplication, `@vitest/coverage-v8` wired into both `vitest.config.ts` and CI, and a real test gate added to the release workflow (which currently has none).

**Tech Stack:** TypeScript, Vitest 2.1.x + jsdom, `@vitest/coverage-v8`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-22-button-test-coverage-spec.md` (read §1–§7 before starting — §7 documents the confirmed bug behind Task 1, and this plan's line citations were independently re-verified against the source and a real `vitest run --coverage` baseline while writing it).

## Global Constraints

- Every task must leave `npm run test:run` green with the *same or higher* test count than before — never fewer, never a regression.
- No new production `dependencies` — `@vitest/coverage-v8` is a `devDependency` only (Task 10).
- Do not split `button.ts` into multiple production modules and do not introduce a DI/config-object abstraction for `window`/`screen`/`crypto` — the spec (§3) explicitly rules this out; keep using the existing mutate-global-and-restore pattern already established in `button.test.ts`.
- New/moved test fixtures live as flat files directly in `src/test/` (Task 2), matching the already-established `src/test/framing-fakes.ts` convention — not a `helpers/` subdirectory. Every test file touched afterward imports from there instead of re-declaring its own copy.
- Match existing test conventions exactly: `describe`/`it` (not `test`), `vi.fn()`/`vi.useFakeTimers()`, explicit `import type` for type-only imports, `.js` extensions on relative imports (this is an ESM `NodeNext`-resolved project — every existing file does this; don't drop the extension).
- No comments in code, in any task below — test names and clear assertions carry the intent. The only two exceptions already in this plan are functional compiler/tool pragmas, not explanatory prose: `// @ts-expect-error` (Task 4, required for TS to accept an intentionally-invalid assignment) and `/* v8 ignore next N -- reason */` (Task 10, the coverage tool's own ignore-hint syntax). Don't add narrative `//` comments to any new test or production code beyond those two.
- Baseline before this plan (re-verified against the actual worktree base, `origin/main`, on 2026-09-22 — see "Branch-drift reconciliation" below): **205 tests / 15 files, all green**, real measured coverage: **94.79% stmts / 88.44% branch / 98.5% funcs / 94.79% lines** (`src/**/*.ts`, excluding `src/test/**`, `src/foundation/**`, `src/version.ts`, `src/types.ts`). Task 10's thresholds are calibrated against this real number, not a guess. Treat every other exact test-count number later in this plan (e.g. "148 tests", "156 tests") as **relative deltas from the count at the start of that task**, not absolute — those numbers were computed against an earlier branch state (see below) and the starting point has moved. Always get the actual number by running the command; the plan's numbers are a sanity check on the *shape* of the change (roughly this many new tests), not a literal target.

### Branch-drift reconciliation (read before dispatching any task)

This plan was written against branch `docs/sync-cdn-readme-examples`, which turned out to be **behind** `main` — `main` had already merged a substantial cross-frame/iframe-navigation feature (`src/framing.ts` + `src/test/framing.test.ts` + `src/test/framing-fakes.ts`) that this plan never saw. The implementation worktree branches from `main`, so here is what actually changed and how each task adjusts. Every implementer dispatch below should get the relevant bullet inline (already folded into the task text further down):

- **`button.ts`**: `isSecurityError`, `isMobileViewport` (now via `viewportWidth()`), and same-window navigation now delegate to a new `src/framing.ts` module. The Task 1 bug (`setBusy`'s stale `logo` closure) **is still present, byte-for-byte**, just ~4 lines further down the file — Task 1's code blocks are unchanged and still match verbatim. The one real change: `renderButton`'s default `mode` is now `'popup'` (a separate, already-merged change), so Task 1's regression test must pass `{ mode: 'redirect' }` explicitly to keep testing the icon in isolation from popup/framing behavior.
- **`overlay.ts`**: `tryReadTopDocument`'s inline non-`SecurityError` console.warn branch was extracted into `framing.ts`'s `sameOriginTop()`, which already has its own test ("rethrows anything that is not a SecurityError" in `framing.test.ts`). Task 6's planned "non-SecurityError warn path" test in this plan's earlier drafting targeted code that **no longer exists in `overlay.ts`** — drop it (Task 6 below no longer lists it). A new `overlayDetach`/`pagehide` cleanup feature was added and already has its own tests in the current `overlay.test.ts` — no action needed. A real coverage run against the current `overlay.ts` also surfaced one gap this plan didn't originally have: the "Return to Maytes" link's non-`SecurityError` rethrow branch — added to Task 7 below.
- **`redirect.ts`**: `performRedirect` now delegates actual navigation to `framing.ts`'s `navigateTopLevel()` and throws `MaytesError` if it can't escape an iframe. `isHttpUrl` itself is untouched — Task 5 is unaffected.
- **`state.ts`**: added one field (`overlayDetach: (() => void) | null`) for the overlay cleanup above. `generatePopupName`/`createInstanceState`'s existing logic is untouched — Task 4 needs one extra default-value assertion, otherwise unaffected.
- **`styles.ts`, `branding.ts`, `errors.ts`, `env.ts`, `maytes.ts`**: byte-for-byte identical to what this plan was written against — Tasks 4 (init.test.ts part), 8, 9 need no changes.
- **`framing.ts` itself** has two small uncovered branches (`severOpener`'s rethrow, `navigateTopLevel`'s outer catch-all on `window.open` throwing) that a coverage run surfaced. **Ruling:** out of scope for this plan — `framing.ts` wasn't part of the original spec (it didn't exist yet), already has 93.54%/89.28% stmt/branch coverage and its own actively-maintained test file from a different, concurrent workstream; adding tests to a file this plan doesn't own risks colliding with that work. If a reviewer flags it, the answer is "deliberately out of scope, see this note."
- Test-fixture convention: the current test suite already established a **flat** shared-fixture file (`src/test/framing-fakes.ts`, imported as `./framing-fakes.js`), not a `src/test/helpers/` subdirectory. Task 2 below was rewritten to match — the new fixture files are `src/test/fake-location.ts` and `src/test/fake-popup.ts`, imported the same flat way.

---

### Task 1: Fix the busy/idle icon stale-closure bug, then lock it with a regression test

This is first because it's the one item in the spec that's an actual shopper-facing bug, not a coverage gap (see spec §7, finding 1). Confirmed by direct repro while writing this plan: after a button's *first* busy→idle cycle, every subsequent busy cycle silently keeps showing the logo instead of the spinner, because `setBusy` closes over the original `logo` element once and later replaces a *different* (already-swapped-in) element without updating that reference — `Node.replaceWith()` on a detached node is a spec-compliant no-op in every browser, not a jsdom artifact.

**Files:**
- Modify: `src/button.ts:184-201`
- Test: `src/test/button.test.ts` (append near the existing "second click after rejection works" test, ~line 761)

**Interfaces:**
- Consumes: nothing new — `buildLogo()` (returns `SVGSVGElement`) and `buildSpinner()` (returns `HTMLSpanElement`), both already defined above in `button.ts`.
- Produces: no new exports. `setBusy`'s external behavior (attributes, event dispatch) is unchanged — only the icon-swap bookkeeping is fixed. Nothing downstream depends on the old `logo` closure variable's name.

- [ ] **Step 1: Write the failing regression test**

Add this test inside the existing `describe('maytes.renderButton', ...)` block in `src/test/button.test.ts` (e.g. right after the `'second click after rejection works (no leftover busy state)'` test):

```ts
  it('shows the spinner again on a SECOND busy cycle, not just the first', async () => {
    let attempt = 0;
    const createCheckout = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('first fails');
      return { checkoutId: 'second' };
    });
    Maytes({ createCheckout, environment: 'sandbox' }).renderButton(container, { mode: 'redirect' });
    const button = container.querySelector('button')!;

    button.click();
    expect(button.querySelector('.maytes-checkout-button__spinner')).not.toBeNull();
    expect(button.querySelector('.maytes-checkout-button__logo')).toBeNull();
    await vi.waitFor(() => expect(button.hasAttribute('aria-disabled')).toBe(false));
    expect(button.querySelector('.maytes-checkout-button__logo')).not.toBeNull();
    expect(button.querySelector('.maytes-checkout-button__spinner')).toBeNull();

    button.click();
    expect(button.querySelector('.maytes-checkout-button__spinner')).not.toBeNull();
    expect(button.querySelector('.maytes-checkout-button__logo')).toBeNull();
    await vi.waitFor(() => expect(assignSpy).toHaveBeenCalled());
    expect(assignSpy).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=second');
  });
```

- [ ] **Step 2: Run it and confirm it fails against the current (buggy) code**

Run: `npm run test:run -- button.test.ts`
Expected: **FAIL** on the `// Second cycle` assertions — `.maytes-checkout-button__spinner` is `null` (the logo is still showing) even though the button is mid-click and `aria-disabled`/`aria-busy` are set.

- [ ] **Step 3: Fix `setBusy` in `src/button.ts`**

Replace the button-construction + `setBusy` block (currently `src/button.ts:184-201`):

```ts
  const labelNode = document.createTextNode(`${label} `);
  const logo = buildLogo();
  button.appendChild(labelNode);
  button.appendChild(logo);

  const setBusy = (busy: boolean) => {
    state.busy = busy;
    if (busy) {
      button.setAttribute('aria-disabled', 'true');
      button.setAttribute('aria-busy', 'true');
      logo.replaceWith(buildSpinner());
    } else {
      button.removeAttribute('aria-disabled');
      button.removeAttribute('aria-busy');
      const currentIndicator = button.querySelector('.maytes-checkout-button__spinner, .maytes-checkout-button__logo');
      if (currentIndicator !== null) currentIndicator.replaceWith(buildLogo());
    }
  };
```

with:

```ts
  const labelNode = document.createTextNode(`${label} `);
  let icon: SVGSVGElement | HTMLSpanElement = buildLogo();
  button.appendChild(labelNode);
  button.appendChild(icon);

  const setBusy = (busy: boolean) => {
    state.busy = busy;
    if (busy) {
      button.setAttribute('aria-disabled', 'true');
      button.setAttribute('aria-busy', 'true');
      const spinner = buildSpinner();
      icon.replaceWith(spinner);
      icon = spinner;
    } else {
      button.removeAttribute('aria-disabled');
      button.removeAttribute('aria-busy');
      const nextLogo = buildLogo();
      icon.replaceWith(nextLogo);
      icon = nextLogo;
    }
  };
```

The bug was the `const logo` closure being replaced *by value* in the DOM but never reassigned in JS — every `setBusy(true)` after the first called `.replaceWith()` on an already-detached node (a silent no-op per the DOM spec). Tracking the *current* indicator in a `let icon` that's reassigned on every swap fixes it without a live DOM query.

- [ ] **Step 4: Run the full suite and confirm everything passes**

Run: `npm run test:run`
Expected: **PASS**, 206 tests (205 existing + 1 new), 15 files.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no new TS errors — `icon`'s type covers both `SVGSVGElement` and `HTMLSpanElement`, matching `buildLogo()`'s and `buildSpinner()`'s return types).

- [ ] **Step 6: Commit**

```bash
git add src/button.ts src/test/button.test.ts
git commit -m "fix: track the button's current icon by reference so the busy spinner reappears on every checkout attempt, not just the first"
```

---

### Task 2: Extract shared test fixtures (flat files in `src/test/`) — dedupe, no behavior change

`button.test.ts` and `redirect.test.ts` each hand-roll a near-identical fake `window.location`; `makeFakePopup()` is private to `button.test.ts`; `button.test.ts` and `overlay.test.ts` each hand-roll the same DOM-reset boilerplate. Every task after this one writes new tests — do this first so nothing new gets copy-pasted a fourth time.

**Files:**
- Create: `src/test/fake-location.ts`
- Create: `src/test/fake-popup.ts`
- Create: `src/test/reset-dom.ts`
- Modify: `src/test/button.test.ts` (imports + `beforeEach`/`afterEach`, remove local `makeFakePopup`/`FakePopup`/`FakePopupLocation`)
- Modify: `src/test/redirect.test.ts` (imports + `beforeEach`/`afterEach`)
- Modify: `src/test/overlay.test.ts` (imports + `beforeEach`/`afterEach`)

**Interfaces:**
- Produces: `installFakeLocation(): { assignSpy: Mock; replaceSpy: Mock; restore(): void }` from `./fake-location.js`; `makeFakePopup(): FakePopup` (+ exported `FakePopup`/`FakePopupLocation` types) from `./fake-popup.js`; `resetMaytesDomForTests(): void` from `./reset-dom.js`. Every later task (3, 4, 6, 7) imports these instead of declaring its own.

- [ ] **Step 1: Create `src/test/fake-location.ts`**

```ts
import { vi } from 'vitest';

export interface FakeLocation {
  assignSpy: ReturnType<typeof vi.fn>;
  replaceSpy: ReturnType<typeof vi.fn>;
  restore(): void;
}

export function installFakeLocation(): FakeLocation {
  const originalLocation = window.location;
  const assignSpy = vi.fn();
  const replaceSpy = vi.fn();
  let currentHref = 'http://localhost/';
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...originalLocation,
      get href() { return currentHref; },
      set href(v: string) { currentHref = v; assignSpy(v); },
      replace: (v: string) => { currentHref = v; replaceSpy(v); },
    },
  });
  return {
    assignSpy,
    replaceSpy,
    restore() {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    },
  };
}
```

- [ ] **Step 2: Create `src/test/fake-popup.ts`**

```ts
import { vi } from 'vitest';

export interface FakePopupLocation {
  href: string;
  replace: ReturnType<typeof vi.fn>;
}

export interface FakePopup {
  closed: boolean;
  focus: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  location: FakePopupLocation;
  document: Document;
}

export function makeFakePopup(): FakePopup {
  const popupDoc = document.implementation.createHTMLDocument('maytes-popup');
  const location: FakePopupLocation = {
    href: 'about:blank',
    replace: vi.fn((url: string) => { location.href = url; }),
  };
  return {
    closed: false,
    focus: vi.fn(),
    close: vi.fn(function (this: FakePopup) { this.closed = true; }),
    location,
    document: popupDoc,
  };
}
```

- [ ] **Step 3: Create `src/test/reset-dom.ts`**

```ts
import { resetStylesForTests } from '../styles.js';

export function resetMaytesDomForTests(): void {
  resetStylesForTests();
  document.querySelectorAll('[data-maytes-overlay]').forEach((el) => el.remove());
  document.head.querySelectorAll('style[data-maytes-checkout-button-overlay-styles]').forEach((el) => el.remove());
}
```

- [ ] **Step 4: Update `src/test/button.test.ts` to use the helpers**

Remove the local `FakePopupLocation`/`FakePopup` interfaces and `makeFakePopup` function (currently lines 8-34 — line numbers throughout this task are approximate given the file has grown since this plan was written; match by the content shown, not the exact line), and add:

```ts
import { makeFakePopup, type FakePopup } from './fake-popup.js';
import { installFakeLocation } from './fake-location.js';
import { resetMaytesDomForTests } from './reset-dom.js';
```

Replace the `beforeEach`/`afterEach` block (currently lines 49-82):

```ts
  beforeEach(() => {
    resetMaytesDomForTests();

    const fakeLocation = installFakeLocation();
    assignSpy = fakeLocation.assignSpy;
    restoreLocation = fakeLocation.restore;

    originalOpen = window.open;
    openSpy = vi.fn((_url?: string | URL, _name?: string, _features?: string) => makeFakePopup() as unknown as Window);
    window.open = openSpy as unknown as typeof window.open;

    container = document.createElement('div');
    document.body.appendChild(container);

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    restoreLocation();
    window.open = originalOpen;
    container.remove();
    document.querySelectorAll('[data-maytes-overlay]').forEach((el) => el.remove());
  });
```

and update the `let` declarations just above `beforeEach` (currently lines 43-47) — drop `originalLocation` (now internal to the helper) and add `restoreLocation`:

```ts
  let openSpy: ReturnType<typeof vi.fn>;
  let assignSpy: ReturnType<typeof vi.fn>;
  let restoreLocation: () => void;
  let originalOpen: typeof window.open;
  let container: HTMLElement;
```

Every existing use of `makeFakePopup()` and `FakePopup`/`FakePopupLocation` types in the rest of the file is unchanged (same names, now imported instead of locally declared).

- [ ] **Step 5: Update `src/test/redirect.test.ts` to use the shared location fake**

Add `import { installFakeLocation } from './fake-location.js';` and replace the `describe('maytes.redirectToCheckout', ...)` block's `beforeEach`/`afterEach` (currently lines 64-82):

```ts
  let assignSpy: ReturnType<typeof vi.fn>;
  let replaceSpy: ReturnType<typeof vi.fn>;
  let restoreLocation: () => void;

  beforeEach(() => {
    const fakeLocation = installFakeLocation();
    assignSpy = fakeLocation.assignSpy;
    replaceSpy = fakeLocation.replaceSpy;
    restoreLocation = fakeLocation.restore;
  });

  afterEach(() => {
    restoreLocation();
  });
```

(Delete the old `originalLocation`/manual `Object.defineProperty` block entirely — the helper does the same thing.)

- [ ] **Step 6: Update `src/test/overlay.test.ts` to use the shared DOM-reset helper**

Add `import { resetMaytesDomForTests } from './reset-dom.js';` and replace the `beforeEach` body (currently lines 16-22):

```ts
  beforeEach(() => {
    resetMaytesDomForTests();
    state = makeState();
    ensureStylesInjected(undefined);
  });
```

(The `afterEach` — `hideOverlay(state)` plus removing the cloned overlay-styles marker — can stay as-is; `resetMaytesDomForTests()` covers the *next* test's setup, which is the part that was duplicated.)

- [ ] **Step 7: Run the full suite — same test count, all green, pure refactor**

Run: `npm run test:run`
Expected: **PASS**, 206 tests (unchanged from Task 1's end state), 15 files. No new tests were added in this task — if the count changed, something was accidentally duplicated or dropped during the extraction.

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/test/fake-location.ts src/test/fake-popup.ts src/test/reset-dom.ts src/test/button.test.ts src/test/redirect.test.ts src/test/overlay.test.ts
git commit -m "test: extract shared fake-location/fake-popup/reset-dom fixtures out of button/redirect/overlay tests"
```

---

### Task 3: `button.test.ts` — mobile boundary, popup centering fallback, popup refocus/close error handling

Closes spec items #2, #3 (positive case), #4, #5. Import `closePopupWindow` and `stopPopupPoll` directly — both are already exported from `button.ts`.

**Files:**
- Modify: `src/test/button.test.ts`

**Interfaces:**
- Consumes: `closePopupWindow(popup: Window | null): void` and `stopPopupPoll(state: InstanceState): void`, both exported from `../button.js`; `makeFakePopup`/`FakePopup` from `./fake-popup.js` (Task 2).

- [ ] **Step 1: Add the imports**

At the top of `src/test/button.test.ts`, add two new import lines (both needed later in this task — `closePopupWindow`/`stopPopupPoll` for Step 5's direct unit tests, `createInstanceState` to build a bare `InstanceState` for `stopPopupPoll`, which takes state, not a popup):

```ts
import { closePopupWindow, stopPopupPoll } from '../button.js';
import { createInstanceState } from '../state.js';
```

- [ ] **Step 2: Write the mobile-viewport-boundary tests**

Add inside `describe('maytes.renderButton', ...)`, near the existing `'popup mode behaves as same-window redirect on mobile'` test:

```ts
  it('popup mode at innerWidth=600 (boundary) still behaves as same-window redirect (mobile)', async () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 });
    try {
      Maytes({ createCheckout: async () => ({ checkoutId: 'boundary-mobile' }), environment: 'sandbox' })
        .renderButton(container, { mode: 'popup' });
      container.querySelector('button')!.click();
      await vi.waitFor(() => expect(assignSpy).toHaveBeenCalled());
      expect(assignSpy).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=boundary-mobile');
      expect(openSpy).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    }
  });

  it('popup mode at innerWidth=601 (just above the boundary) opens a popup (desktop)', async () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 601 });
    try {
      const popup = makeFakePopup();
      openSpy.mockReturnValueOnce(popup as unknown as Window);
      Maytes({ createCheckout: async () => ({ checkoutId: 'boundary-desktop' }), environment: 'sandbox' })
        .renderButton(container, { mode: 'popup' });
      container.querySelector('button')!.click();
      expect(openSpy).toHaveBeenCalledOnce();
      await vi.waitFor(() => expect(popup.location.replace).toHaveBeenCalled());
      expect(popup.location.replace).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=boundary-desktop');
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    }
  });
```

- [ ] **Step 3: Write the `popupFeatures()` centering-fallback test**

`popupFeatures()` isn't exported (matching the file's existing convention of testing internal helpers indirectly through the click flow — see how the mobile test above never imports `isMobileViewport`). Assert on the third argument `window.open` was called with:

```ts
  it('centers the popup using default dimensions when window.screen is unavailable', async () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    const originalScreen = window.screen;
    Object.defineProperty(window, 'screen', { configurable: true, value: undefined });
    try {
      Maytes({ createCheckout: async () => ({ checkoutId: 'no-screen' }), environment: 'sandbox' })
        .renderButton(container, { mode: 'popup' });
      container.querySelector('button')!.click();
      expect(openSpy).toHaveBeenCalledOnce();
      const features = openSpy.mock.calls[0]?.[2] as string;
      expect(features).toContain('width=500,height=800,left=0,top=0');
    } finally {
      Object.defineProperty(window, 'screen', { configurable: true, value: originalScreen });
    }
  });
```

- [ ] **Step 4: Write the `refocusPopup` SecurityError-swallowed test (positive case)**

```ts
  it('proceeds normally when popup.focus() throws a SecurityError (cross-origin refocus denied)', async () => {
    const popup = makeFakePopup();
    popup.focus.mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    openSpy.mockReturnValueOnce(popup as unknown as Window);
    Maytes({ createCheckout: async () => ({ checkoutId: 'refocus-blocked' }), environment: 'sandbox' })
      .renderButton(container, { mode: 'popup' });
    container.querySelector('button')!.click();
    expect(popup.focus).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(popup.location.replace).toHaveBeenCalled());
    expect(popup.location.replace).toHaveBeenCalledWith('https://sandbox-checkout.maytes.co/?id=refocus-blocked');
  });
```

  > Note: the *rethrow* half of this contract (a non-`SecurityError` propagates instead of being swallowed) is covered by Step 5 below via `closePopupWindow`, which shares the exact same `isSecurityError` swallow/rethrow logic on a synchronous, already-exported function. Driving that same assertion through `refocusPopup` itself would require either exporting an internal helper or asserting on an unhandled promise rejection from inside an event-listener callback (fragile, environment-dependent) — not worth it when the shared predicate is already exercised directly.

- [ ] **Step 5: Write direct unit tests for `closePopupWindow` and `stopPopupPoll`**

Add a new `describe` block (can go at the end of the file, before the closing of the outer `describe`, or as a sibling top-level `describe`):

```ts
describe('closePopupWindow (direct)', () => {
  it('is a no-op when passed null', () => {
    expect(() => closePopupWindow(null)).not.toThrow();
  });

  it('closes an open popup', () => {
    const popup = makeFakePopup();
    closePopupWindow(popup as unknown as Window);
    expect(popup.close).toHaveBeenCalledOnce();
  });

  it('does not call .close() again on an already-closed popup', () => {
    const popup = makeFakePopup();
    popup.closed = true;
    closePopupWindow(popup as unknown as Window);
    expect(popup.close).not.toHaveBeenCalled();
  });

  it('swallows a SecurityError thrown while reading .closed or calling .close()', () => {
    const throwing = {
      get closed(): boolean { throw new DOMException('blocked', 'SecurityError'); },
      close: vi.fn(),
    } as unknown as Window;
    expect(() => closePopupWindow(throwing)).not.toThrow();
  });

  it('rethrows a non-SecurityError thrown while reading .closed or calling .close()', () => {
    const throwing = {
      get closed(): boolean { throw new Error('boom'); },
      close: vi.fn(),
    } as unknown as Window;
    expect(() => closePopupWindow(throwing)).toThrow('boom');

    const throwingDom = {
      get closed(): boolean { throw new DOMException('blocked', 'NotAllowedError'); },
      close: vi.fn(),
    } as unknown as Window;
    expect(() => closePopupWindow(throwingDom)).toThrow(DOMException);
  });
});

describe('stopPopupPoll (direct)', () => {
  it('clears the interval and nulls the handle', () => {
    vi.useFakeTimers();
    try {
      const state = createInstanceState({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' }, undefined);
      state.popupPollHandle = setInterval(() => {}, 500);
      stopPopupPoll(state);
      expect(state.popupPollHandle).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('is a no-op when the handle is already null', () => {
    const state = createInstanceState({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' }, undefined);
    expect(() => stopPopupPoll(state)).not.toThrow();
    expect(state.popupPollHandle).toBeNull();
  });
});
```

- [ ] **Step 6: Run the full suite**

Run: `npm run test:run`
Expected: PASS, **217 tests** (206 + 11 new: 2 mobile-boundary + 1 screen-fallback + 1 refocus-SecurityError-swallowed + 5 `closePopupWindow` + 2 `stopPopupPoll`), 15 files. If your count differs slightly, that's fine as long as it's higher than 206 and every new assertion above is present — this number is a sanity check, not a hard gate.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/test/button.test.ts
git commit -m "test: cover mobile-viewport boundary, popup centering fallback, and popup focus/close error handling in button.ts"
```

---

### Task 4: New `state.test.ts` (popup-name generation + config passthrough) + `init.test.ts` non-object-options gap

Closes spec items #6, #7. Also closes one gap the spec's list missed but a real coverage run surfaced: `maytes.ts`'s `validateOptions` throws when `options` itself isn't an object (`Maytes(null)`, `Maytes(undefined)`, etc.) — this is in `docs/overview.md`'s own behavior-contract table, but no existing test exercises it.

**Files:**
- Create: `src/test/state.test.ts`
- Modify: `src/test/init.test.ts`

**Interfaces:**
- Consumes: `createInstanceState(options, internal): InstanceState` from `../state.js`; `Maytes`, `MaytesError` from `../index.js`; `type MaytesOptions` from `../index.js`.

- [ ] **Step 1: Create `src/test/state.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createInstanceState } from '../state.js';

describe('generatePopupName (via createInstanceState)', () => {
  let originalRandomUUID: typeof crypto.randomUUID;

  beforeEach(() => {
    originalRandomUUID = crypto.randomUUID;
  });

  afterEach(() => {
    crypto.randomUUID = originalRandomUUID;
  });

  it('uses crypto.randomUUID() when available', () => {
    const state = createInstanceState(
      { createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' },
      undefined,
    );
    expect(state.popupName).toMatch(/^maytes-checkout-[0-9a-f-]{36}$/);
  });

  it('falls back to a timestamp/random suffix when crypto.randomUUID is unavailable', () => {
    // @ts-expect-error -- simulating an environment without crypto.randomUUID
    crypto.randomUUID = undefined;
    const state = createInstanceState(
      { createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' },
      undefined,
    );
    expect(state.popupName).toMatch(/^maytes-checkout-[0-9a-z]+-[0-9a-z]+$/);
  });

  it('falls back when crypto.randomUUID throws', () => {
    crypto.randomUUID = vi.fn(() => { throw new Error('unsupported'); }) as typeof crypto.randomUUID;
    const state = createInstanceState(
      { createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' },
      undefined,
    );
    expect(state.popupName).toMatch(/^maytes-checkout-[0-9a-z]+-[0-9a-z]+$/);
  });

  it('produces a unique name on each call, even in the fallback path', () => {
    // @ts-expect-error -- simulating an environment without crypto.randomUUID
    crypto.randomUUID = undefined;
    const a = createInstanceState({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' }, undefined);
    const b = createInstanceState({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' }, undefined);
    expect(a.popupName).not.toBe(b.popupName);
  });
});

describe('createInstanceState config passthrough', () => {
  it('copies only createCheckout + environment when internal options are absent', () => {
    const createCheckout = async () => ({ checkoutId: 'x' });
    const state = createInstanceState({ createCheckout, environment: 'production' }, undefined);
    expect(state.config).toEqual({ createCheckout, environment: 'production' });
  });

  it('copies baseUrl and cspNonce onto config only when provided', () => {
    const createCheckout = async () => ({ checkoutId: 'x' });
    const state = createInstanceState(
      { createCheckout, environment: 'sandbox' },
      { baseUrl: 'https://example.com', cspNonce: 'nonce-1' },
    );
    expect(state.config.baseUrl).toBe('https://example.com');
    expect(state.config.cspNonce).toBe('nonce-1');
  });

  it('initializes busy/destroyed/popup/overlay/teardowns to their documented defaults', () => {
    const state = createInstanceState({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' }, undefined);
    expect(state.busy).toBe(false);
    expect(state.destroyed).toBe(false);
    expect(state.overlayEl).toBeNull();
    expect(state.overlayDetach).toBeNull();
    expect(state.popupWindow).toBeNull();
    expect(state.popupNavigated).toBe(false);
    expect(state.popupPollHandle).toBeNull();
    expect(state.teardowns).toEqual(new Set());
  });
});
```

- [ ] **Step 2: Run just this new file**

Run: `npx vitest run src/test/state.test.ts`
Expected: PASS, 7 tests, 1 file.

- [ ] **Step 3: Add the `validateOptions` non-object-options test to `init.test.ts`**

Add `import type { MaytesOptions } from '../index.js';` to the top of `src/test/init.test.ts`, then add inside `describe('Maytes() factory', ...)`:

```ts
  it('throws CONFIG when options itself is not an object (null, undefined, or a primitive)', () => {
    expect(() => Maytes(null as unknown as MaytesOptions)).toThrow(MaytesError);
    expect(() => Maytes(undefined as unknown as MaytesOptions)).toThrow(MaytesError);
    expect(() => Maytes('nope' as unknown as MaytesOptions)).toThrow(MaytesError);
    expect(() => Maytes(42 as unknown as MaytesOptions)).toThrow(MaytesError);
  });
```

- [ ] **Step 4: Run the full suite**

Run: `npm run test:run`
Expected: PASS, 225 tests (217 + 7 in `state.test.ts` + 1 in `init.test.ts`), **16 files**.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/test/state.test.ts src/test/init.test.ts
git commit -m "test: cover popup-name generation (incl. crypto.randomUUID fallback), state config passthrough, and Maytes() non-object-options validation"
```

---

### Task 5: `redirect.test.ts` — direct `isHttpUrl` unit tests

Closes spec item #8. Also closes a real gap a coverage run surfaced: the malformed-URL branch of `isHttpUrl` (`catch { return false; }`) has zero coverage today — no existing test passes a genuinely unparsable string.

**Files:**
- Modify: `src/test/redirect.test.ts`

**Interfaces:**
- Consumes: `isHttpUrl(value: string): boolean`, already exported from `../redirect.js`.

- [ ] **Step 1: Add the import and test**

Add `isHttpUrl` to the existing `import { ... } from '../index.js';`-style import at the top — since `isHttpUrl` is exported from `redirect.ts` directly (not re-exported from `index.ts`), add its own import line:

```ts
import { isHttpUrl } from '../redirect.js';
```

Add a new top-level `describe`:

```ts
describe('isHttpUrl', () => {
  it.each([
    ['https://example.com', true],
    ['http://example.com', true],
    ['https://example.com/checkout?id=abc', true],
  ])('%s -> %s', (value, expected) => {
    expect(isHttpUrl(value)).toBe(expected);
  });

  it.each([
    ['javascript:alert(1)', false],
    ['data:text/html,<script>alert(1)</script>', false],
    ['not a url', false],
    ['', false],
    ['ftp://example.com', false],
  ])('%s -> %s', (value, expected) => {
    expect(isHttpUrl(value)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run the full suite**

Run: `npm run test:run`
Expected: PASS, 233 tests (225 + 8 new), 16 files.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/test/redirect.test.ts
git commit -m "test: add direct isHttpUrl unit tests, closing the malformed-URL branch gap"
```

---

### Task 6: `overlay.test.ts` — re-show guard, `showModal` failure paths

Closes spec items #9, #10, #11.

**Branch-drift note:** this task originally also planned a fourth test for `tryReadTopDocument`'s non-`SecurityError` console.warn branch (spec §2 item, "bonus gap"). That branch **no longer exists in `overlay.ts`** — it was extracted into `src/framing.ts`'s `sameOriginTop()` when the cross-frame navigation feature merged, and is already covered there by framing.test.ts's "rethrows anything that is not a SecurityError" test. Do not add that test here; there is nothing left in `overlay.ts` for it to cover.

Confirmed while writing this plan: this repo's jsdom (25.0.1) does **not** implement `HTMLDialogElement.prototype.showModal` at all (`typeof dialog.showModal === 'function'` is `false` out of the box) — every existing overlay-mounting test already runs the fallback branch, it's just never asserted explicitly (Step 2 below adds that assertion). The `showModal`-*throws* branch (Step 3) needs a deliberate stub since jsdom has no native method to throw from.

**Files:**
- Modify: `src/test/overlay.test.ts`

**Interfaces:**
- Consumes: `showOverlay`, `hideOverlay` from `../overlay.js` (already imported in this file); `vi` from `vitest` (needs adding to the existing import).

- [ ] **Step 1: Add `vi` to the vitest import and write the re-show guard test**

Change the top import to `import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';` and add:

```ts
  it('showOverlay is idempotent — calling it twice while shown does not create a second dialog', () => {
    showOverlay(state);
    showOverlay(state);
    expect(document.querySelectorAll('[data-maytes-overlay]').length).toBe(1);
  });
```

- [ ] **Step 2: Write the explicit "showModal unavailable" assertion**

```ts
  it('falls back to inline open + backdrop when dialog.showModal is unavailable', () => {
    showOverlay(state);
    const dialog = document.querySelector('[data-maytes-overlay]') as HTMLDialogElement;
    expect(typeof dialog.showModal).not.toBe('function');
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.style.background).toBe('rgba(0, 0, 0, 0.6)');
  });
```

- [ ] **Step 3: Write the "showModal throws" fallback test**

```ts
  it('falls back to inline open + backdrop when dialog.showModal throws', () => {
    const proto = HTMLDialogElement.prototype as unknown as { showModal?: () => void };
    proto.showModal = () => { throw new DOMException('not supported here', 'InvalidStateError'); };
    try {
      showOverlay(state);
      const dialog = document.querySelector('[data-maytes-overlay]') as HTMLDialogElement;
      expect(dialog.hasAttribute('open')).toBe(true);
      expect(dialog.style.background).toBe('rgba(0, 0, 0, 0.6)');
    } finally {
      delete proto.showModal;
    }
  });
```

- [ ] **Step 4: Run the full suite**

Run: `npm run test:run`
Expected: PASS, +3 tests over this task's starting count, same file count (no new file in this task).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/test/overlay.test.ts
git commit -m "test: cover overlay re-show guard and showModal failure/unavailable fallback"
```

---

### Task 7: `overlay.test.ts` — "Return to Maytes" link, cross-frame style dedup guard, `hideOverlay` cleanup assertion

Closes spec items #12, #13, #14.

**Known residual gap, deliberately not chased:** a real coverage run against the current `overlay.ts` shows the "Return to Maytes" link's `if (!isSecurityError(err)) throw err;` rethrow branch as uncovered. Do not add a click-driven test for it. Verified empirically while writing this plan: jsdom does not propagate a synchronous throw from an event listener back through the `.click()` call that triggered it (the DOM dispatch algorithm "reports" the exception out-of-band instead) — `expect(() => link.click()).toThrow(...)` does not catch anything here, it just leaves an unhandled error for the test runner to report separately. This is the same shape of gap as Task 3's `refocusPopup` rethrow branch, and the same resolution applies: the `isSecurityError` predicate itself is already directly tested (`framing.test.ts`, plus Task 3's `closePopupWindow` rethrow test), so the swallow/rethrow *contract* has coverage — only this one specific call site's one-line `throw err;` doesn't, and it isn't worth a fragile test to close.

**Files:**
- Modify: `src/test/overlay.test.ts`

**Interfaces:**
- Consumes: `showOverlay`, `hideOverlay` (already imported); `state.popupWindow` field on `InstanceState` (already available via the file's existing `state` variable).

- [ ] **Step 1: Write the "Return to Maytes" link tests**

```ts
  it('"Return to Maytes" link refocuses the popup when it is open and not closed', () => {
    showOverlay(state);
    const fakePopup = { closed: false, focus: vi.fn() } as unknown as Window;
    state.popupWindow = fakePopup;
    const link = document.querySelector('.maytes-checkout-overlay__link') as HTMLButtonElement;
    link.click();
    expect((fakePopup as unknown as { focus: ReturnType<typeof vi.fn> }).focus).toHaveBeenCalledOnce();
  });

  it('"Return to Maytes" link is a no-op when there is no open popup', () => {
    showOverlay(state);
    const link = document.querySelector('.maytes-checkout-overlay__link') as HTMLButtonElement;

    state.popupWindow = null;
    expect(() => link.click()).not.toThrow();

    const closedPopup = { closed: true, focus: vi.fn() } as unknown as Window;
    state.popupWindow = closedPopup;
    link.click();
    expect((closedPopup as unknown as { focus: ReturnType<typeof vi.fn> }).focus).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Write the cross-frame style dedup-guard test**

This targets `ensureOverlayStylesInTopDocument`'s `if (host.querySelector(...) !== null) return;` guard directly — pre-seed the parent document with the marker before calling `showOverlay` (a plain show→hide→show cycle never re-hits this branch, since `hideOverlay` always removes the clone first):

```ts
  it('does not clone the button-style tag again if the top document already carries the marker', () => {
    const parentDoc = document.implementation.createHTMLDocument('parent');
    const existingMarker = parentDoc.createElement('style');
    existingMarker.setAttribute('data-maytes-checkout-button-overlay-styles', '');
    existingMarker.textContent = '/* pre-existing */';
    parentDoc.head.appendChild(existingMarker);

    const originalTop = Object.getOwnPropertyDescriptor(window, 'top');
    Object.defineProperty(window, 'top', {
      configurable: true,
      get: () => ({ document: parentDoc } as unknown as Window),
    });
    try {
      showOverlay(state);
      const clones = parentDoc.head.querySelectorAll('style[data-maytes-checkout-button-overlay-styles]');
      expect(clones.length).toBe(1);
      expect(clones[0]?.textContent).toBe('/* pre-existing */');
    } finally {
      if (originalTop !== undefined) {
        Object.defineProperty(window, 'top', originalTop);
      } else {
        Object.defineProperty(window, 'top', { configurable: true, get: () => window });
      }
    }
  });
```

- [ ] **Step 3: Write the `hideOverlay` cloned-style-removal test**

```ts
  it('hideOverlay removes the cloned cross-frame style tag', () => {
    const parentDoc = document.implementation.createHTMLDocument('parent');
    const originalTop = Object.getOwnPropertyDescriptor(window, 'top');
    Object.defineProperty(window, 'top', {
      configurable: true,
      get: () => ({ document: parentDoc } as unknown as Window),
    });
    try {
      showOverlay(state);
      expect(parentDoc.head.querySelector('style[data-maytes-checkout-button-overlay-styles]')).not.toBeNull();
      hideOverlay(state);
      expect(parentDoc.head.querySelector('style[data-maytes-checkout-button-overlay-styles]')).toBeNull();
    } finally {
      if (originalTop !== undefined) {
        Object.defineProperty(window, 'top', originalTop);
      } else {
        Object.defineProperty(window, 'top', { configurable: true, get: () => window });
      }
    }
  });
```

- [ ] **Step 4: Run the full suite**

Run: `npm run test:run`
Expected: PASS, 240 tests (236 + 4 new), 16 files.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/test/overlay.test.ts
git commit -m "test: cover the Return-to-Maytes link, cross-frame style-clone dedup guard, and hideOverlay cleanup"
```

---

### Task 8: New `src/test/styles.test.ts` — direct ref-count unit tests

Closes spec item #15. `styles.ts` today has no dedicated test file — every assertion about it lives inside `button.test.ts`, exercised as a side effect of rendering/destroying buttons.

**Files:**
- Create: `src/test/styles.test.ts`

**Interfaces:**
- Consumes: `ensureStylesInjected(cspNonce: string | undefined): void`, `releaseStyles(): void`, `resetStylesForTests(): void` — all already exported from `../styles.js`.

- [ ] **Step 1: Write the file**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ensureStylesInjected, releaseStyles, resetStylesForTests } from '../styles.js';

const SELECTOR = 'style[data-maytes-checkout-button]';

describe('styles ref-counting (direct, no button/DOM involved)', () => {
  beforeEach(() => {
    resetStylesForTests();
  });

  it('injects the style tag on the first call', () => {
    expect(document.head.querySelector(SELECTOR)).toBeNull();
    ensureStylesInjected(undefined);
    expect(document.head.querySelector(SELECTOR)).not.toBeNull();
  });

  it('only injects one style tag across repeated calls', () => {
    ensureStylesInjected(undefined);
    ensureStylesInjected(undefined);
    ensureStylesInjected(undefined);
    expect(document.head.querySelectorAll(SELECTOR).length).toBe(1);
  });

  it('removes the style tag once every consumer releases', () => {
    ensureStylesInjected(undefined);
    ensureStylesInjected(undefined);
    releaseStyles();
    expect(document.head.querySelector(SELECTOR)).not.toBeNull();
    releaseStyles();
    expect(document.head.querySelector(SELECTOR)).toBeNull();
  });

  it('clamps the ref-count at zero — an extra release does not go negative or throw', () => {
    ensureStylesInjected(undefined);
    releaseStyles();
    expect(() => releaseStyles()).not.toThrow();
    expect(document.head.querySelector(SELECTOR)).toBeNull();
    ensureStylesInjected(undefined);
    expect(document.head.querySelectorAll(SELECTOR).length).toBe(1);
  });

  it('resetStylesForTests() fully resets ref-count and removes any injected tag', () => {
    ensureStylesInjected(undefined);
    ensureStylesInjected(undefined);
    resetStylesForTests();
    expect(document.head.querySelector(SELECTOR)).toBeNull();
    ensureStylesInjected(undefined);
    releaseStyles();
    expect(document.head.querySelector(SELECTOR)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the full suite**

Run: `npm run test:run`
Expected: PASS, 245 tests (240 + 5 new), **17 files**.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/test/styles.test.ts
git commit -m "test: add direct ensureStylesInjected/releaseStyles ref-count unit tests"
```

---

### Task 9: New `src/test/branding.test.ts` — `buildMaytesLogo` contract

Closes spec item #16. Note: a real coverage run showed `branding.ts` already at 100% line/branch coverage today (it's exercised indirectly by every button/overlay/popup-loading-screen test) — this task is about **pinning the explicit public contract**, not closing a coverage hole, so a future edit to the logo paths or sizing can't silently drift without a test noticing.

**Files:**
- Create: `src/test/branding.test.ts`

**Interfaces:**
- Consumes: `buildMaytesLogo(height: string, color: string): SVGSVGElement`, already exported from `../branding.js`.

- [ ] **Step 1: Write the file**

```ts
import { describe, it, expect } from 'vitest';
import { buildMaytesLogo } from '../branding.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

describe('buildMaytesLogo', () => {
  it('returns an SVG element in the SVG namespace with the documented viewBox', () => {
    const svg = buildMaytesLogo('2rem', '#000000');
    expect(svg.namespaceURI).toBe(SVG_NS);
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 1199.47 289.04');
    expect(svg.getAttribute('xmlns')).toBe(SVG_NS);
  });

  it('maps height/color arguments onto style.height/style.color', () => {
    const svg = buildMaytesLogo('2.75rem', 'rgb(1, 2, 3)');
    expect(svg.style.height).toBe('2.75rem');
    expect(svg.style.width).toBe('auto');
    expect(svg.style.color).toBe('rgb(1, 2, 3)');
  });

  it('renders one namespaced <path> per source path, each filled with currentColor', () => {
    const svg = buildMaytesLogo('1em', 'currentColor');
    const paths = svg.querySelectorAll('path');
    expect(paths.length).toBeGreaterThan(0);
    paths.forEach((path) => {
      expect(path.namespaceURI).toBe(SVG_NS);
      expect(path.getAttribute('fill')).toBe('currentColor');
      expect(path.getAttribute('d')?.length).toBeGreaterThan(0);
    });
  });

  it('creates independent SVG instances on repeated calls (no shared/mutated state)', () => {
    const first = buildMaytesLogo('1em', 'red');
    const second = buildMaytesLogo('2em', 'blue');
    expect(first).not.toBe(second);
    expect(first.style.height).toBe('1em');
    expect(second.style.height).toBe('2em');
  });
});
```

- [ ] **Step 2: Run the full suite**

Run: `npm run test:run`
Expected: PASS, 249 tests (245 + 4 new), **18 files**.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/test/branding.test.ts
git commit -m "test: pin buildMaytesLogo's SVG contract (viewBox, sizing, path structure)"
```

---

### Task 10: Add coverage measurement (`@vitest/coverage-v8`)

By this point all 16 spec gaps (minus the one dropped and plus the one added per the branch-drift reconciliation above) are closed, so the threshold set here reflects genuinely improved coverage rather than a guess. A coverage run against the actual worktree base (`main`, before Task 1) measured the suite at 94.79% stmts / 88.44% branch / 98.5% funcs / 94.79% lines — already comfortably above the thresholds below, so this task is safe to land even if run standalone; it should be *more* comfortable after Tasks 1–9.

**Files:**
- Modify: `package.json` (devDependency + script)
- Modify: `vitest.config.ts`
- Modify: `src/redirect.ts:50-55` (ignore hint for the one line-range that's genuinely unreachable under jsdom)

**Interfaces:** none — tooling only, no runtime code changes beyond the ignore-hint comment.

- [ ] **Step 1: Install the coverage provider**

Run: `npm install -D @vitest/coverage-v8@2.1.9`

(Match the installed `vitest` version — this repo pins `"vitest": "^2.1.5"`; `2.1.9` is within that range as of writing. If a newer `2.1.x` has since been released, use that instead — just keep it on the `2.1.x` line to match `vitest` itself.)

- [ ] **Step 2: Add the `coverage` block to `vitest.config.ts`**

Replace the full file:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/test/**',
        'src/foundation/**',
        'src/version.ts',
        'src/types.ts',
      ],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
});
```

(`src/version.ts` and `src/types.ts` are excluded because they carry no runtime branching logic — `version.ts` is a generated one-line literal, `types.ts` is pure `interface`/`type` declarations. Without excluding them, `types.ts` reports as `0%` across every metric — not because it's untested, but because it has nothing to execute — which drags the aggregate down for no useful signal.)

- [ ] **Step 3: Add the `test:coverage` script to `package.json`**

In the `"scripts"` block, add (alongside the existing `"test"`/`"test:run"` entries):

```json
    "test:coverage": "vitest run --coverage",
```

- [ ] **Step 4: Annotate the one genuinely-unreachable branch in `src/redirect.ts`**

`performRedirect`'s `typeof window === 'undefined'` guard can't be hit inside jsdom (this package's own test environment always has `window` defined) and isn't worth faking a non-browser environment for. Replace (currently `src/redirect.ts:49-55`):

```ts
export function performRedirect(url: string, replace: boolean): void {
  if (typeof window === 'undefined') {
    throw new MaytesError(
      MaytesErrorCode.Config,
      'redirectToCheckout requires a browser context (window is undefined)',
    );
  }
```

with:

```ts
export function performRedirect(url: string, replace: boolean): void {
  /* v8 ignore next 6 -- unreachable under jsdom; window is always defined in this SDK's browser-only distribution */
  if (typeof window === 'undefined') {
    throw new MaytesError(
      MaytesErrorCode.Config,
      'redirectToCheckout requires a browser context (window is undefined)',
    );
  }
```

- [ ] **Step 5: Run coverage and confirm the thresholds pass**

Run: `npm run test:coverage`
Expected: PASS — all four thresholds (90/90/90/85) met, and the per-file table shows meaningfully higher numbers than the pre-plan baseline (94.79/88.44/98.5/94.79) now that Tasks 1–9 closed the gaps in `button.ts`, `state.ts`, `overlay.ts`, `redirect.ts`. If any single number lands *below* its threshold, don't lower the threshold to make it pass — go back and check whether one of Tasks 3–9's tests was skipped or miswritten.

- [ ] **Step 6: Run the full non-coverage suite once more and typecheck**

Run: `npm run test:run && npm run typecheck`
Expected: PASS, 249 tests, 18 files (unchanged from Task 9 — this task adds no new test cases, only tooling).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/redirect.ts
git commit -m "chore: add @vitest/coverage-v8 with 90/90/90/85 thresholds; ignore the unreachable SSR guard in redirect.ts"
```

---

### Task 11: Close the release-gate hole — wire tests into CI properly

This is the concrete fix for the framing problem in spec §1: `pr.yml` gates merges; `release.yml` gates nothing. A push to `main` that somehow bypassed a green PR (bad merge, branch-protection misconfiguration, manual push) currently publishes to npm and deploys to the CDN with zero test execution in that workflow run.

**Files:**
- Modify: `.github/workflows/pr.yml`
- Modify: `.github/workflows/release.yml`

**Interfaces:** none — CI config only.

- [ ] **Step 1: Swap `test:run` for `test:coverage` in the PR gate**

In `.github/workflows/pr.yml`, in the `verify` job, replace:

```yaml
      - run: npm run test:run
```

with:

```yaml
      - run: npm run test:coverage
```

(Same job, same position — `typecheck` still runs first, `build`/`audit` still run after. A coverage regression now fails the PR the same way a broken test does today.)

- [ ] **Step 2: Add a `test` job to `release.yml` and gate `release` on it**

In `.github/workflows/release.yml`, add a new job above the existing `release:` job:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: package-lock.json
      - run: npm ci
      - run: npm run typecheck
      - run: npm run test:coverage

  release:
    if: github.event_name == 'push'
    needs: test
    runs-on: ubuntu-latest
```

(Only the `if:`/`runs-on:` lines of the existing `release:` job change — add `needs: test` right after `if: github.event_name == 'push'`; everything below `runs-on: ubuntu-latest` in that job is unchanged. Leave the `cdn-deploy` job, which only runs on `workflow_dispatch` for a manual redeploy of an already-published version, untouched — it doesn't build a new release, so it doesn't need this gate.)

- [ ] **Step 3: Validate the workflow YAML parses**

This repo has no YAML linter installed, so use `npx`'s one-shot fetch instead of adding a new dependency for a single check:

Run: `npx -y js-yaml .github/workflows/release.yml > /dev/null && npx -y js-yaml .github/workflows/pr.yml > /dev/null && echo "both files parse cleanly"`

Expected: prints `both files parse cleanly` with no error output. This only confirms the YAML is syntactically valid (correct indentation, no tab/space mix, `needs:` nested correctly under the `release:` job) — it does not confirm the workflow logic is correct; that's only provable by actually pushing/merging and watching the Action run (see the note at the end of this task).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/pr.yml .github/workflows/release.yml
git commit -m "ci: gate the release workflow on typecheck+coverage, not just the PR that preceded it"
```

  This can only be fully verified by actually pushing/merging and watching the Action run — note that in the PR description when this lands, so a reviewer knows to check the Actions tab rather than just reading the diff.

---

### Task 12: Refresh `docs/overview.md`'s stale "Testing" section

Closes spec §3 item 6. This doc is what the coverage-gap analysis was checked against while writing the spec — keep it trustworthy for the next person who reads it before touching this code.

**Files:**
- Modify: `docs/overview.md` (the "### Unit tests" subsection under "## Testing")

**Interfaces:** none — documentation only.

- [ ] **Step 1: Get the real final numbers**

Run: `npm run test:run` and `npm run test:coverage`. Note the final total test count, file count, and the four coverage percentages from the coverage table's "All files" row.

- [ ] **Step 2: Update the table and surrounding prose**

In `docs/overview.md`, replace the line:

```
Coverage — **111 tests across 7 files** (`src/test/`):
```

with the actual current count from Step 1 (by the end of this plan it should read **249 tests across 18 files**, assuming no task above needed adjustment — use your own measured number, not this one, if it differs).

Update the table beneath it to add rows for the three new files this plan introduced (`state.test.ts`, `styles.test.ts`, `branding.test.ts`) with a one-line description each, e.g.:

```
| `state.test.ts` | 7 | popup-name generation (`crypto.randomUUID` + fallback), `createInstanceState` config passthrough and defaults |
| `styles.test.ts` | 5 | direct `ensureStylesInjected`/`releaseStyles` ref-counting (no button/DOM involved) |
| `branding.test.ts` | 4 | `buildMaytesLogo` SVG contract (viewBox, sizing, path structure) |
```

and bump the existing `button.test.ts`, `redirect.test.ts`, `overlay.test.ts` row counts to match what Tasks 3, 5, 6, 7 actually added.

- [ ] **Step 3: Add a one-line coverage-tooling mention**

Immediately after the table, add:

```
Run `npm run test:coverage` for a coverage report (thresholds: 90% lines/statements/functions, 85% branches — enforced in both `pr.yml` and `release.yml`).
```

- [ ] **Step 4: Commit**

```bash
git add docs/overview.md
git commit -m "docs: refresh the stale test-count table and note the new coverage tooling"
```

---

## Sequencing summary

1 (bug fix) → 2 (shared test helpers) → 3–9 (new test cases, each independently landable, each building on Task 2's helpers) → 10 (coverage tooling, calibrated against the now-improved suite) → 11 (the actual release-gate fix — the reason this whole plan exists) → 12 (docs refresh, last, since it needs the final numbers).

Every task above ends with `npm run test:run` (and, from Task 10 onward, `npm run test:coverage`) green before moving to the next — do not batch multiple tasks' commits together even though they're all in the same file in a few cases (e.g. Tasks 6 and 7 both touch `overlay.test.ts`).
