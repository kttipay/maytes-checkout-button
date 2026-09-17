export const CDN_EXAMPLE_START = '<!-- @cdn-example-start -->';
export const CDN_EXAMPLE_END = '<!-- @cdn-example-end -->';

/**
 * Regenerates the `<script>` CDN example block between the
 * `@cdn-example-*` markers in README.md so it always shows the current
 * release's SemVer and content-hash URLs, mirroring `injectSriBlock`'s
 * treatment of CHANGELOG.md.
 *
 * Returns the updated README, or `null` if the markers aren't present.
 */
export function injectCdnExample(readme, { semverUrl, hashedUrl }) {
  const startIdx = readme.indexOf(CDN_EXAMPLE_START);
  const endIdx = readme.indexOf(CDN_EXAMPLE_END);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;

  const block = [
    CDN_EXAMPLE_START,
    '```html',
    `<script src="${semverUrl}"`,
    '        integrity="sha384-…"',
    '        crossorigin="anonymous"></script>',
    '```',
    '',
    '```html',
    `<script src="${hashedUrl}"`,
    '        integrity="sha384-…"',
    '        crossorigin="anonymous"></script>',
    '```',
    CDN_EXAMPLE_END,
  ].join('\n');

  return readme.slice(0, startIdx) + block + readme.slice(endIdx + CDN_EXAMPLE_END.length);
}
