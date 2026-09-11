import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashedUrl, semverPath, semverUrl } from './lib/cdn-config.mjs';
import { injectSriBlock } from './lib/changelog.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const sdkRoot = resolve(here, '..');
const dist = resolve(sdkRoot, 'dist');
const pkg = JSON.parse(readFileSync(resolve(sdkRoot, 'package.json'), 'utf8'));

const targets = [
  { src: 'checkout-button.js', kind: 'iife' },
  { src: 'checkout-button.mjs', kind: 'esm' },
  { src: 'checkout-button.cjs', kind: 'cjs' },
];

const integrity = { version: pkg.version, builtAt: new Date().toISOString(), files: {} };

for (const { src, kind } of targets) {
  const srcPath = resolve(dist, src);
  if (!existsSync(srcPath)) {
    console.error(`[hash-and-sri] missing ${src} — run "npm run build" first`);
    process.exit(1);
  }
  const content = readFileSync(srcPath);
  const sha256Hex = createHash('sha256').update(content).digest('hex');
  const shortHash = sha256Hex.slice(0, 8);
  const sha384B64 = createHash('sha384').update(content).digest('base64');

  const ext = src.match(/(\.[^.]+)$/)[1];
  const stem = src.slice(0, -ext.length);
  const hashedName = `${stem}.${shortHash}${ext}`;
  const hashedPath = resolve(dist, hashedName);
  copyFileSync(srcPath, hashedPath);

  const mapSrc = `${srcPath}.map`;
  if (existsSync(mapSrc)) {
    copyFileSync(mapSrc, `${hashedPath}.map`);
  }

  integrity.files[src] = {
    kind,
    hashedName,
    semverPath: semverPath(pkg.version, src).slice(1),
    semverUrl: semverUrl(pkg.version, src),
    hashedUrl: hashedUrl(hashedName),
    sri: `sha384-${sha384B64}`,
    sha256: sha256Hex,
    shortHash,
    bytes: content.length,
  };

  console.log(`[hash-and-sri] ${src} -> ${hashedName} | sri=sha384-${sha384B64.slice(0, 16)}...`);
}

writeFileSync(resolve(dist, 'integrity.json'), JSON.stringify(integrity, null, 2));

// Whether to touch CHANGELOG.md is decided by one question: did
// `changeset version` already create a `## <version>` section for this
// version? The release path is `changeset version && npm run build`, so on a
// real release the section exists and this script's only job is to inject SRI
// into it. If it's absent, this is an ordinary local/CI build of an
// already-released (or never-released) version — injecting would invent a
// changelog entry, complete with CDN links, for bytes that will never be
// published under this version number.
//
// This used to be gated on `pkg.private === true`, which worked only while
// publishing was switched off. The going-live flip (`private: false`) silently
// turned every local `npm run build` into a changelog writer.
const changelogPath = resolve(sdkRoot, 'CHANGELOG.md');
const existingChangelog = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf8') : null;

{
  const bundleNames = ['checkout-button.js', 'checkout-button.mjs', 'checkout-button.cjs'];
  const iife = integrity.files[bundleNames[0]];
  const linkLine = (sourceName, url, label = sourceName) => `- [${label}](${url})`;

  const sriBlockLines = [
    '<!-- @hash-sri-start -->',
    '',
    '**SRI hashes** (use these in `<script integrity="..." crossorigin="anonymous">`):',
    '',
    '```',
    `checkout-button.js   ${iife.sri}`,
    `checkout-button.mjs  ${integrity.files['checkout-button.mjs'].sri}`,
    `checkout-button.cjs  ${integrity.files['checkout-button.cjs'].sri}`,
    '```',
    '',
    '**SemVer CDN links** (readable production pins; use with the SRI hashes above):',
    '',
    ...bundleNames.map((sourceName) => linkLine(sourceName, integrity.files[sourceName].semverUrl)),
    '',
    '**Hashed CDN links** (byte-level production pins; use with the SRI hashes above):',
    '',
    ...bundleNames.map((sourceName) =>
      linkLine(sourceName, integrity.files[sourceName].hashedUrl, integrity.files[sourceName].hashedName),
    ),
    '',
    '<!-- @hash-sri-end -->',
  ];

  const sriBlock = sriBlockLines.join('\n');

  const updated =
    existingChangelog === null ? null : injectSriBlock(existingChangelog, pkg.version, sriBlock);

  if (updated === null) {
    console.log(
      `[hash-and-sri] wrote dist/integrity.json (${pkg.version}); CHANGELOG injection skipped ` +
        `(no "## ${pkg.version}" section — not a release build)`,
    );
  } else {
    writeFileSync(changelogPath, updated);
    console.log(`[hash-and-sri] wrote dist/integrity.json + CHANGELOG.md (${pkg.version})`);
  }
}
