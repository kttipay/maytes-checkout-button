export function verifyReleaseHash(input: {
  tag: string;
  sourceName: string;
  recomputedSri: string;
  changelogSri: string | undefined;
  integritySri: string;
}): { ok: true } | { ok: false; message: string };

export function checkTagCoverage(input: {
  tagCount: number;
  changelogVersionCount: number;
}): { ok: true } | { ok: false; message: string };
