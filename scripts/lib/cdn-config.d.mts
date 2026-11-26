export const CDN_ORIGIN: 'https://js.maytes.co';

export const SHOWN_PING_FILE: 'button-shown.txt';

export function cdnUrl(path: string): string;

export function semverPath(version: string, sourceName: string): string;

export function semverUrl(version: string, sourceName: string): string;

export function hashedUrl(hashedName: string): string;

export function majorPath(version: string, sourceName: string): string;

export function buildCdnConfig(
  releases: Array<{
    version: string;
    files: Record<string, { hashedName: string }>;
  }>,
): { headers: string; redirects: string };
