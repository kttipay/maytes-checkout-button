import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const target = join(root, 'src', 'version.ts');
const next = `export const SDK_VERSION = '${version}';\n`;

let current = '';
try {
  current = readFileSync(target, 'utf8');
} catch {
  current = '';
}

if (current !== next) {
  writeFileSync(target, next);
  console.log(`[gen-version] src/version.ts -> ${version}`);
} else {
  console.log(`[gen-version] src/version.ts already ${version}`);
}
