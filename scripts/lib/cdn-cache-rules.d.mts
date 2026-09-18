export interface CacheRuleStatusCodeOverride {
  statusCode: number;
  ttl: number;
}

export interface CacheRule {
  id: string;
  expression: string;
  edgeTtl?: number;
  browserTtl?: number;
  edgeTtlStatusCodeOverrides?: CacheRuleStatusCodeOverride[];
  bypass?: boolean;
}

export const SEMVER_PIN_WILDCARD: string;
export const HASH_PIN_WILDCARD: string;
export const EVERGREEN_WILDCARD: string;
export const DEV_BRANCH_WILDCARD: string;
export const UNHASHED_BUNDLE_PATHS: string[];

export const CACHE_RULES: [CacheRule, CacheRule, CacheRule];

export function rulesetNeedsUpdate(currentRules: CacheRule[], desiredRules?: CacheRule[]): boolean;
