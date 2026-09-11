import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sdkRoot = resolve(here, '..');
const dist = resolve(sdkRoot, 'dist');

const targets = ['checkout-button.js', 'checkout-button.mjs', 'checkout-button.cjs'];

const FORBIDDEN = [
  { name: 'eval(', pattern: /\beval\s*\(/g, why: 'CSP: violates script-src; opens code-injection vectors.' },
  { name: 'new Function(', pattern: /\bnew\s+Function\s*\(/g, why: 'CSP: equivalent to eval; same risk.' },
  { name: 'Function(', pattern: /(?<!\w)Function\s*\(/g, why: 'CSP: equivalent to eval; same risk.' },
  { name: 'setTimeout(string', pattern: /\bsetTimeout\s*\(\s*['"`]/g, why: 'CSP: string form invokes the eval-ish path.' },
  { name: 'setInterval(string', pattern: /\bsetInterval\s*\(\s*['"`]/g, why: 'CSP: string form invokes the eval-ish path.' },
];

let failed = false;

for (const file of targets) {
  const path = resolve(dist, file);
  if (!existsSync(path)) {
    console.error(`[csp-check] missing ${file} — run "npm run build:bundles" first`);
    process.exit(1);
  }
  const content = readFileSync(path, 'utf8');
  for (const { name, pattern, why } of FORBIDDEN) {
    const matches = content.match(pattern);
    if (matches !== null) {
      console.error(`[csp-check] ${file}: ${matches.length}× "${name}" — ${why}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error('[csp-check] FAIL — bundle is not CSP-friendly. Fix sources or audit a flagged usage and add an explicit allowlist comment.');
  process.exit(1);
}

console.log(`[csp-check] PASS — ${targets.length} bundles clean of eval/Function/setTimeout(string).`);
