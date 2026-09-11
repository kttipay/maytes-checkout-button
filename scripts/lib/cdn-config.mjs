export const DEV_CHANNEL_PREFIX = '/dev';
export const CDN_ORIGIN = 'https://js.maytes.co';

const CACHE_IMMUTABLE = 'Cache-Control: public, max-age=31536000, immutable';

export function cdnUrl(path) {
  return `${CDN_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

export function semverPath(version, sourceName) {
  return `/v${version}/${sourceName}`;
}

export function semverUrl(version, sourceName) {
  return cdnUrl(semverPath(version, sourceName));
}

export function hashedUrl(hashedName) {
  return cdnUrl(hashedName);
}

export function buildCdnConfig(integrity) {
  const files = Object.entries(integrity.files);
  const immutablePaths = files.flatMap(([sourceName, meta]) => [
    `/${meta.hashedName}`,
    semverPath(integrity.version, sourceName),
  ]);

  const immutableBlocks = immutablePaths
    .map((path) => `${path}\n  ${CACHE_IMMUTABLE}`)
    .join('\n\n');

  const headers = `/*
  Access-Control-Allow-Origin: *
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

${DEV_CHANNEL_PREFIX}/*
  Cache-Control: public, max-age=300

/integrity.json
  Cache-Control: public, max-age=60

${immutableBlocks}
`;

  const redirects = files
    .flatMap(([sourceName, meta]) => [
      `${DEV_CHANNEL_PREFIX}/${sourceName}   /${sourceName}   200`,
      `${semverPath(integrity.version, sourceName)}   /${meta.hashedName}   200`,
    ])
    .join('\n') + '\n';

  return { headers, redirects };
}
