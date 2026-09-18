import { latestPerMajor } from './semver-lite.mjs';

export const DEV_CHANNEL_PREFIX = '/dev';
export const CDN_ORIGIN = 'https://js.maytes.co';

const CACHE_SHORT = 'Cache-Control: public, max-age=300';

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

export function majorPath(version, sourceName) {
  const major = version.split('.')[0];
  return `/v${major}/${sourceName}`;
}

export function majorUrl(version, sourceName) {
  return cdnUrl(majorPath(version, sourceName));
}

export function buildCdnConfig(releases) {
  const current = releases[0];

  const headers = `/*
  Access-Control-Allow-Origin: *
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

${DEV_CHANNEL_PREFIX}/*
  ${CACHE_SHORT}

/integrity.json
  Cache-Control: public, max-age=60
`;

  const devRedirects = Object.keys(current.files).map(
    (sourceName) => `${DEV_CHANNEL_PREFIX}/${sourceName}   /${sourceName}   200`,
  );

  const pinRedirects = releases.flatMap(({ version, files }) =>
    Object.entries(files).map(
      ([sourceName, meta]) => `${semverPath(version, sourceName)}   /${meta.hashedName}   200`,
    ),
  );

  const releaseByVersion = new Map(releases.map((release) => [release.version, release]));
  const latestByMajor = latestPerMajor(releases.map((release) => release.version));

  const evergreenRedirects = [...latestByMajor.values()].flatMap((version) => {
    const release = releaseByVersion.get(version);
    return Object.entries(release.files).map(
      ([sourceName, meta]) => `${majorPath(version, sourceName)}   /${meta.hashedName}   200`,
    );
  });

  const redirects = [...devRedirects, ...pinRedirects, ...evergreenRedirects].join('\n') + '\n';

  return { headers, redirects };
}
