export const CDN_EXAMPLE_START: string;
export const CDN_EXAMPLE_END: string;

export function injectCdnExample(
  readme: string,
  urls: { semverUrl: string; hashedUrl: string },
): string | null;
