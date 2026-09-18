import { CACHE_RULES, rulesetNeedsUpdate } from './lib/cdn-cache-rules.mjs';

const zoneId = process.env.CLOUDFLARE_ZONE_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
if (!zoneId || !apiToken) {
  console.error('[ensure-cdn-cache-rules] CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN are required');
  process.exit(1);
}

const rulesetUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/phases/http_request_cache_settings/entrypoint`;
const requestHeaders = {
  Authorization: `Bearer ${apiToken}`,
  'Content-Type': 'application/json',
};

function toApiRule(rule) {
  if (rule.bypass) {
    return {
      description: rule.id,
      expression: rule.expression,
      action: 'set_cache_settings',
      action_parameters: { cache: false },
    };
  }

  return {
    description: rule.id,
    expression: rule.expression,
    action: 'set_cache_settings',
    action_parameters: {
      cache: true,
      edge_ttl: {
        mode: 'override_origin',
        default: rule.edgeTtl,
        status_code_ttl: (rule.edgeTtlStatusCodeOverrides ?? []).map(({ statusCode, ttl }) => ({
          status_code: statusCode,
          value: ttl,
        })),
      },
      browser_ttl: { mode: 'override_origin', default: rule.browserTtl },
    },
  };
}

function fromApiRule(apiRule) {
  if (apiRule.action_parameters?.cache === false) {
    return { id: apiRule.description, expression: apiRule.expression, bypass: true };
  }

  return {
    id: apiRule.description,
    expression: apiRule.expression,
    edgeTtl: apiRule.action_parameters?.edge_ttl?.default,
    browserTtl: apiRule.action_parameters?.browser_ttl?.default,
    edgeTtlStatusCodeOverrides: (apiRule.action_parameters?.edge_ttl?.status_code_ttl ?? []).map(
      ({ status_code, value }) => ({ statusCode: status_code, ttl: value }),
    ),
  };
}

const getResponse = await fetch(rulesetUrl, { headers: requestHeaders });
if (!getResponse.ok) {
  console.error(
    '[ensure-cdn-cache-rules] failed to read the current ruleset, refusing to overwrite it blindly:',
    await getResponse.text(),
  );
  process.exit(1);
}

const getBody = await getResponse.json();
const existingApiRules = getBody.result?.rules ?? [];
const ownedIds = new Set(CACHE_RULES.map((rule) => rule.id));
const currentOwned = existingApiRules.filter((rule) => ownedIds.has(rule.description)).map(fromApiRule);
const foreignApiRules = existingApiRules.filter((rule) => !ownedIds.has(rule.description));

if (!rulesetNeedsUpdate(currentOwned, CACHE_RULES)) {
  console.log('[ensure-cdn-cache-rules] already up to date, no changes needed');
  process.exit(0);
}

const putResponse = await fetch(rulesetUrl, {
  method: 'PUT',
  headers: requestHeaders,
  body: JSON.stringify({ rules: [...foreignApiRules, ...CACHE_RULES.map(toApiRule)] }),
});

if (!putResponse.ok) {
  console.error('[ensure-cdn-cache-rules] failed to update cache rules:', await putResponse.text());
  process.exit(1);
}

console.log('[ensure-cdn-cache-rules] cache rules updated');
