import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSriRecords } from './lib/changelog.mjs';
import { checkTagCoverage, verifyReleaseHash } from './lib/release-verification.mjs';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const sdkRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(sdkRoot, 'dist');
const cacheRoot = resolve(sdkRoot, '.cdn-history-cache');

const pkg = readJson(resolve(sdkRoot, 'package.json'));

const currentIntegrityPath = resolve(dist, 'integrity.json');
if (!existsSync(currentIntegrityPath)) {
  console.error('[rehydrate-cdn-history] dist/integrity.json missing — run "npm run build" first');
  process.exit(1);
}
const currentIntegrity = readJson(currentIntegrityPath);

const tags = execFileSync('git', ['tag', '-l', 'v*'], { cwd: sdkRoot, encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .filter((tag) => tag !== `v${pkg.version}`);

const changelogPath = resolve(sdkRoot, 'CHANGELOG.md');
const changelogText = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf8') : '';
const changelogVersionCount = [...changelogText.matchAll(/^## \S+/gm)].length;

const coverage = checkTagCoverage({ tagCount: tags.length, changelogVersionCount });
if (!coverage.ok) {
  console.error(coverage.message);
  process.exit(1);
}

const sriRecords = extractSriRecords(changelogText);
const releases = [currentIntegrity];

for (const tag of tags) {
  const version = tag.slice(1);
  const tagCacheDir = resolve(cacheRoot, tag);
  mkdirSync(tagCacheDir, { recursive: true });

  const integrityPath = resolve(tagCacheDir, 'integrity.json');
  if (!existsSync(integrityPath)) {
    execFileSync(
      'gh',
      [
        'release', 'download', tag,
        '--pattern', 'integrity.json',
        '--pattern', 'checkout-button.*',
        '--dir', tagCacheDir,
        '--clobber',
      ],
      { cwd: sdkRoot, stdio: 'inherit' },
    );
  }

  const integrity = readJson(integrityPath);
  const changelogSriForVersion = sriRecords.get(version);

  for (const [sourceName, meta] of Object.entries(integrity.files)) {
    const bundlePath = resolve(tagCacheDir, meta.hashedName);
    const bytes = readFileSync(bundlePath);
    const recomputedSri = `sha384-${createHash('sha384').update(bytes).digest('base64')}`;

    const result = verifyReleaseHash({
      tag,
      sourceName,
      recomputedSri,
      changelogSri: changelogSriForVersion?.[sourceName],
      integritySri: meta.sri,
    });
    if (!result.ok) {
      console.error(result.message);
      process.exit(1);
    }

    copyFileSync(bundlePath, resolve(dist, meta.hashedName));
    const mapPath = `${bundlePath}.map`;
    if (existsSync(mapPath)) {
      copyFileSync(mapPath, resolve(dist, `${meta.hashedName}.map`));
    }
  }

  releases.push(integrity);
}

writeFileSync(resolve(dist, '_releases-manifest.json'), JSON.stringify(releases, null, 2));
console.log(
  `[rehydrate-cdn-history] verified and staged ${releases.length} release(s) (${tags.length} historical + current)`,
);
