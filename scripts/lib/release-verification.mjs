export function verifyReleaseHash({ tag, sourceName, recomputedSri, changelogSri, integritySri }) {
  const reference = changelogSri ?? integritySri;
  if (recomputedSri !== reference) {
    return {
      ok: false,
      message: `[rehydrate-cdn-history] MISMATCH ${tag} ${sourceName}: got ${recomputedSri}, expected ${reference}`,
    };
  }
  return { ok: true };
}

export function checkTagCoverage({ tagCount, changelogVersionCount }) {
  if (changelogVersionCount >= 2 && tagCount === 0) {
    return {
      ok: false,
      message:
        `[rehydrate-cdn-history] CHANGELOG.md records ${changelogVersionCount} version(s) but 0 git tags were ` +
        `found — tags are probably not being fetched (check 'fetch-tags: true' on the checkout step).`,
    };
  }
  return { ok: true };
}
