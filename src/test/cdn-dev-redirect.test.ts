import { describe, expect, it } from 'vitest';
import { DEV_PREVIEW_ORIGIN, DEV_REDIRECT_RULE, redirectNeedsUpdate } from '../../scripts/lib/cdn-dev-redirect.mjs';

describe('DEV_REDIRECT_RULE', () => {
  it('scopes the rule to js.maytes.co and the /dev/ path', () => {
    expect(DEV_REDIRECT_RULE.expression).toContain('http.host eq "js.maytes.co"');
    expect(DEV_REDIRECT_RULE.expression).toContain('http.request.uri.path wildcard "/dev/*"');
  });

  it('rewrites the matched suffix onto the Pages preview origin', () => {
    expect(DEV_REDIRECT_RULE.targetUrlExpression).toContain(DEV_PREVIEW_ORIGIN);
    expect(DEV_REDIRECT_RULE.targetUrlExpression).toContain('wildcard_replace');
  });

  it('redirects with a 302 (temporary, since the target can change on every dev push)', () => {
    expect(DEV_REDIRECT_RULE.statusCode).toBe(302);
  });
});

describe('redirectNeedsUpdate', () => {
  it('reports no update needed when the current rule already matches', () => {
    expect(redirectNeedsUpdate(DEV_REDIRECT_RULE)).toBe(false);
  });

  it('reports an update needed when there is no current rule', () => {
    expect(redirectNeedsUpdate(undefined)).toBe(true);
  });

  it('reports an update needed when the expression changed', () => {
    expect(redirectNeedsUpdate({ ...DEV_REDIRECT_RULE, expression: 'old' })).toBe(true);
  });

  it('reports an update needed when the target changed', () => {
    expect(redirectNeedsUpdate({ ...DEV_REDIRECT_RULE, targetUrlExpression: 'old' })).toBe(true);
  });

  it('reports an update needed when the status code changed', () => {
    expect(redirectNeedsUpdate({ ...DEV_REDIRECT_RULE, statusCode: 301 })).toBe(true);
  });
});
