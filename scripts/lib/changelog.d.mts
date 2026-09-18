export function escapeRegExp(value: string): string;

export function findSectionBounds(
  changelog: string,
  version: string,
): { start: number; end: number } | null;

export function extractSection(changelog: string, version: string): string | null;

export const SRI_START_MARKER: string;
export const SRI_END_MARKER: string;

export function injectSriBlock(
  changelog: string,
  version: string,
  sriBlock: string,
): string | null;

export function extractSriRecords(changelog: string): Map<string, Record<string, string>>;
