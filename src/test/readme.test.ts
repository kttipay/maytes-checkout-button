import { describe, expect, it } from 'vitest';
import { injectCdnExample } from '../../scripts/lib/readme.mjs';

const README = [
  '## Install',
  '',
  'For production, pin an exact release:',
  '',
  '<!-- @cdn-example-start -->',
  '```html',
  '<script src="https://js.maytes.co/v1.0.0/checkout-button.js"',
  '        integrity="sha384-…"',
  '        crossorigin="anonymous"></script>',
  '```',
  '',
  '```html',
  '<script src="https://js.maytes.co/checkout-button.795d508b.js"',
  '        integrity="sha384-…"',
  '        crossorigin="anonymous"></script>',
  '```',
  '<!-- @cdn-example-end -->',
  '',
  'The real version, hash, and SRI for each release live in CHANGELOG.md.',
  '',
].join('\n');

describe('injectCdnExample', () => {
  const urls = {
    semverUrl: 'https://js.maytes.co/v1.0.1/checkout-button.js',
    hashedUrl: 'https://js.maytes.co/checkout-button.8c71493e.js',
  };

  it('returns null when the markers are absent', () => {
    const readme = README.replace('<!-- @cdn-example-start -->\n', '').replace(
      '<!-- @cdn-example-end -->\n',
      '',
    );
    expect(injectCdnExample(readme, urls)).toBeNull();
  });

  it('replaces both example URLs between the markers', () => {
    const updated = injectCdnExample(README, urls) as string;
    expect(updated).toContain(urls.semverUrl);
    expect(updated).toContain(urls.hashedUrl);
    expect(updated).not.toContain('v1.0.0/checkout-button.js');
    expect(updated).not.toContain('795d508b');
  });

  it('leaves the surrounding prose untouched', () => {
    const updated = injectCdnExample(README, urls) as string;
    expect(updated).toContain('For production, pin an exact release:');
    expect(updated).toContain('The real version, hash, and SRI for each release live in CHANGELOG.md.');
  });

  it('is idempotent — re-running with the same URLs is a no-op beyond the markers', () => {
    const once = injectCdnExample(README, urls) as string;
    const twice = injectCdnExample(once, urls) as string;
    expect(twice).toBe(once);
    expect(twice.match(/@cdn-example-start/g)).toHaveLength(1);
  });

  it('keeps the SRI placeholder as a literal ellipsis, not a real hash', () => {
    const updated = injectCdnExample(README, urls) as string;
    expect(updated.match(/integrity="sha384-…"/g)).toHaveLength(2);
  });
});
