# README readability — CDN section

> Scoped to `README.md`'s `## Install` → `### Script tag (CDN)` / `### Evergreen (auto-updating) URL` subsections (lines 39–81 on the branch this was written against). Everything else in the README is out of scope.

## Part 1: readability — proposed, not contingent on Part 2

The CDN section is currently ~40 lines of prose before a reader reaches `### npm`. Two integration paths (pinned, evergreen) are each explained in full paragraphs with no upfront comparison, so a reader has to read both subsections fully before they can tell which one applies to them.

**Proposal:** add a 2-row decision aid immediately after the intro sentence, before either subsection's detail:

```markdown
### Script tag (CDN)

| | Pinned (default) | Evergreen (opt-in) |
|---|---|---|
| **Use when** | Production, always | You've explicitly decided auto-updates matter more than pin-safety |
| **Guarantee** | The bytes you tested are the bytes shipped, forever | Always the newest `1.x` release — including ones you haven't tested |
| **SRI** | Yes | Not possible |

For production, pin an exact release...
[existing pinned content unchanged]

### Evergreen (auto-updating) URL

[existing evergreen content unchanged, still framed as opt-in per Part 2's resolution]
```

This doesn't reorder or shorten either subsection's existing prose (which was itself deliberately worded across several earlier review rounds) — it just gives a reader a 5-second answer before they commit to reading either one in full. Independent of Part 2's outcome: the table's wording changes (see below) but the table itself is worth adding either way.

Also worth doing while touching this section, purely mechanical:
- The top-level feature bullet list (`README.md:28`) says "SRI-verified CDN — pin a release by SemVer or content hash..." with no mention that an evergreen option exists at all. Add a clause so a skimmer who never reaches `## Install` still knows both paths exist: "...published alongside every release; an opt-in evergreen alias trades that guarantee for auto-updates."

## Part 2: "favor and suggest the evergreen CDN" — open decision, not resolved by this doc

This is not a wording change — it reverses the conclusion `docs/cdn-versioning.md`'s "Revisited (2026-09-18)" section already reached, on the record, after weighing this exact question:

> "The reasoning above still holds as the *default*: this SDK doesn't touch card data, so it doesn't inherit Stripe's hot-patch constraint, and pinning remains correct for merchants who don't ask for anything else."

Two ways this doc could resolve, pick one before either gets implemented:

**Option A — keep pin-first (status quo).** The table above reads as drafted (Pinned columns first, labeled "default"; Evergreen labeled "opt-in"). No change to `docs/cdn-versioning.md`. This is the only option consistent with the existing decision record without a new rationale.

**Option B — promote evergreen.** Swap the table's framing (Evergreen first / "recommended"), reorder the two `###` subsections so Evergreen comes first, and update `docs/cdn-versioning.md`'s "Revisited" section to record the new rationale and the date it changed — the same way the original evergreen-vs-no-evergreen decision was recorded, so a future reader isn't left staring at a doc that argues for the opposite of what the README does. Requires an actual stated reason (real merchant feedback, a business call that update-velocity now outweighs the blast-radius risk) — "favor it" alone isn't a rationale the doc can carry forward.

**Resolved: Option B, 2026-09-18.** Implemented in `README.md` and `docs/cdn-versioning.md`'s new "Revisited again" section. Recorded rationale: the blast-radius argument wasn't invalidated by any new fact (this SDK still doesn't touch card data in-browser), the team weighed it against wanting merchants to get updates by default without each one separately noticing a release and bumping a pin, and chose update-velocity. Pinning remains fully supported and documented as the fallback for merchants who'd rather freeze on a tested build.

**Recommendation: Option A.** Nothing in this conversation has surfaced a new fact that invalidates the blast-radius argument (an evergreen release still reaches every opted-in merchant at once, with no rollback, and this SDK still doesn't handle card data). If there's a concrete reason to prefer Option B, name it and I'll write the doc update alongside the README change so they don't drift apart the way `docs/cdn-versioning.md`'s headline TL;DR already drifted from its own body once this session.
