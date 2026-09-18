import { DEV_REDIRECT_RULE, redirectNeedsUpdate } from './lib/cdn-dev-redirect.mjs';

const zoneId = process.env.CLOUDFLARE_ZONE_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
if (!zoneId || !apiToken) {
  console.error('[ensure-cdn-dev-redirect] CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN are required');
  process.exit(1);
}

const rulesetUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/phases/http_request_dynamic_redirect/entrypoint`;
const requestHeaders = {
  Authorization: `Bearer ${apiToken}`,
  'Content-Type': 'application/json',
};

function toApiRule(rule) {
  return {
    description: rule.id,
    expression: rule.expression,
    action: 'redirect',
    action_parameters: {
      from_value: {
        target_url: { expression: rule.targetUrlExpression },
        status_code: rule.statusCode,
        preserve_query_string: true,
      },
    },
  };
}

function fromApiRule(apiRule) {
  return {
    id: apiRule.description,
    expression: apiRule.expression,
    targetUrlExpression: apiRule.action_parameters?.from_value?.target_url?.expression,
    statusCode: apiRule.action_parameters?.from_value?.status_code,
  };
}

const getResponse = await fetch(rulesetUrl, { headers: requestHeaders });
if (!getResponse.ok) {
  console.error(
    '[ensure-cdn-dev-redirect] failed to read the current ruleset, refusing to overwrite it blindly:',
    await getResponse.text(),
  );
  process.exit(1);
}

const getBody = await getResponse.json();
const existingApiRules = getBody.result?.rules ?? [];
const currentApiRule = existingApiRules.find((rule) => rule.description === DEV_REDIRECT_RULE.id);
const foreignApiRules = existingApiRules.filter((rule) => rule.description !== DEV_REDIRECT_RULE.id);

if (!redirectNeedsUpdate(currentApiRule ? fromApiRule(currentApiRule) : undefined)) {
  console.log('[ensure-cdn-dev-redirect] already up to date, no changes needed');
  process.exit(0);
}

const putResponse = await fetch(rulesetUrl, {
  method: 'PUT',
  headers: requestHeaders,
  body: JSON.stringify({ rules: [...foreignApiRules, toApiRule(DEV_REDIRECT_RULE)] }),
});

if (!putResponse.ok) {
  console.error('[ensure-cdn-dev-redirect] failed to update the redirect rule:', await putResponse.text());
  process.exit(1);
}

console.log('[ensure-cdn-dev-redirect] dev-branch redirect rule updated');
