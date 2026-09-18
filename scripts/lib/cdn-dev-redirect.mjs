import { CDN_ORIGIN } from './cdn-config.mjs';
import { DEV_BRANCH_WILDCARD } from './cdn-cache-rules.mjs';

const CDN_HOST = new URL(CDN_ORIGIN).host;
export const DEV_PREVIEW_ORIGIN = 'https://dev.checkout-button.pages.dev';

export const DEV_REDIRECT_RULE = {
  id: 'checkout-button-dev-branch',
  expression: `(http.host eq "${CDN_HOST}") and (http.request.uri.path wildcard "${DEV_BRANCH_WILDCARD}")`,
  targetUrlExpression: `wildcard_replace(http.request.full_uri, "${CDN_ORIGIN}${DEV_BRANCH_WILDCARD}", "${DEV_PREVIEW_ORIGIN}/\${1}")`,
  statusCode: 302,
};

export function redirectNeedsUpdate(currentRule, desiredRule = DEV_REDIRECT_RULE) {
  if (currentRule === undefined) return true;
  return (
    currentRule.expression !== desiredRule.expression ||
    currentRule.targetUrlExpression !== desiredRule.targetUrlExpression ||
    currentRule.statusCode !== desiredRule.statusCode
  );
}
