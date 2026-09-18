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

function browserMaxAge(cacheControl) {
  const match = cacheControl.match(/max-age=(\d+)/);
  if (match === null) {
    throw new Error(`[ensure-cdn-cache-rules] cacheControl has no max-age: ${cacheControl}`);
  }
  return Number(match[1]);
}

const getResponse = await fetch(rulesetUrl, { headers: requestHeaders });
const currentRules = getResponse.ok
  ? (await getResponse.json()).result.rules.map((rule) => ({
      id: rule.description,
      expression: rule.expression,
      cacheControl: `public, max-age=${rule.action_parameters?.browser_ttl?.default ?? 0}`,
    }))
  : [];

if (getResponse.ok && !rulesetNeedsUpdate(currentRules, CACHE_RULES)) {
  console.log('[ensure-cdn-cache-rules] already up to date, no changes needed');
  process.exit(0);
}

const putResponse = await fetch(rulesetUrl, {
  method: 'PUT',
  headers: requestHeaders,
  body: JSON.stringify({
    rules: CACHE_RULES.map((rule) => ({
      description: rule.id,
      expression: rule.expression,
      action: 'set_cache_settings',
      action_parameters: {
        cache: true,
        edge_ttl: { mode: 'override_origin', default: 31536000 },
        browser_ttl: { mode: 'override_origin', default: browserMaxAge(rule.cacheControl) },
      },
    })),
  }),
});

if (!putResponse.ok) {
  console.error('[ensure-cdn-cache-rules] failed to update cache rules:', await putResponse.text());
  process.exit(1);
}

console.log('[ensure-cdn-cache-rules] cache rules updated');
