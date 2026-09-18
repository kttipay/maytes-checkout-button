import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCdnConfig } from './lib/cdn-config.mjs';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

const integrityPath = resolve(dist, 'integrity.json');
if (!existsSync(integrityPath)) {
  console.error('[cdn-config] dist/integrity.json missing — run "npm run build" first');
  process.exit(1);
}
const integrity = JSON.parse(readFileSync(integrityPath, 'utf8'));

const manifestPath = resolve(dist, '_releases-manifest.json');
const hasManifest = existsSync(manifestPath);
const releases = hasManifest ? JSON.parse(readFileSync(manifestPath, 'utf8')) : [integrity];

const { headers, redirects } = buildCdnConfig(releases);

writeFileSync(join(dist, '_headers'), headers);
writeFileSync(join(dist, '_redirects'), redirects);
console.log(
  `[cdn-config] wrote dist/_headers and dist/_redirects for ${releases.length} release(s)` +
    (hasManifest
      ? ''
      : ' (no _releases-manifest.json — current release only; run "npm run cdn-rehydrate" first for full history)'),
);
