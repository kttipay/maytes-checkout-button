export const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function findSectionBounds(changelog, version) {
  const headerRe = new RegExp(`^## ${escapeRegExp(version)}(?= |$)`, 'm');
  const match = changelog.match(headerRe);
  if (match === null) return null;
  const start = match.index;
  const next = changelog.indexOf('\n## ', start + match[0].length);
  const end = next === -1 ? changelog.length : next + 1;
  return { start, end };
}

export function extractSection(changelog, version) {
  const bounds = findSectionBounds(changelog, version);
  return bounds === null ? null : changelog.slice(bounds.start, bounds.end);
}

export const SRI_START_MARKER = '<!-- @hash-sri-start -->';
export const SRI_END_MARKER = '<!-- @hash-sri-end -->';

/**
 * Injects an SRI block into an existing `## <version>` changelog section.
 *
 * Returns the updated changelog, or `null` when there is no section for that
 * version — meaning this is NOT a release build and the changelog must be left
 * alone.
 *
 * The release path is `changeset version && npm run build`: changesets creates
 * the `## <version>` heading, then the build injects SRI into it. So the
 * section's presence is what distinguishes a release build from an ordinary
 * local or CI build. Creating the section here instead would invent a changelog
 * entry — with CDN links — for a version that is never published under that
 * number.
 *
 * Re-injection replaces a previous block rather than stacking a second one, so
 * running the build twice is a no-op on the second run.
 */
export function injectSriBlock(changelog, version, sriBlock) {
  const bounds = findSectionBounds(changelog, version);
  if (bounds === null) return null;

  const section = changelog.slice(bounds.start, bounds.end);
  const startIdx = section.indexOf(SRI_START_MARKER);
  const endIdx = section.indexOf(SRI_END_MARKER);

  const updatedSection =
    startIdx !== -1 && endIdx !== -1 && endIdx > startIdx
      ? section.slice(0, startIdx) + sriBlock + section.slice(endIdx + SRI_END_MARKER.length)
      : section.replace(/\n+$/, '') + '\n\n' + sriBlock + '\n';

  return changelog.slice(0, bounds.start) + updatedSection + changelog.slice(bounds.end);
}

const VERSION_HEADING_RE = /^## (\S+)/gm;

export function extractSriRecords(changelog) {
  const records = new Map();
  const headings = [...changelog.matchAll(VERSION_HEADING_RE)];

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const version = heading[1];
    const start = heading.index ?? 0;
    const end = i + 1 < headings.length ? (headings[i + 1].index ?? changelog.length) : changelog.length;
    const section = changelog.slice(start, end);

    const sriStart = section.indexOf(SRI_START_MARKER);
    const sriEnd = section.indexOf(SRI_END_MARKER);
    if (sriStart === -1 || sriEnd === -1 || sriEnd < sriStart) continue;
    if (records.has(version)) continue;

    const block = section.slice(sriStart, sriEnd);
    const files = {};
    for (const match of block.matchAll(/^(\S+)\s+(sha384-\S+)\s*$/gm)) {
      files[match[1]] = match[2];
    }
    if (Object.keys(files).length > 0) {
      records.set(version, files);
    }
  }

  return records;
}
