export interface CacheRule {
  id: string;
  expression: string;
  edgeTtl: number;
  browserTtl: number;
}

export const SEMVER_PIN_WILDCARD: string;
export const HASH_PIN_WILDCARD: string;
export const EVERGREEN_WILDCARD: string;

export const CACHE_RULES: [CacheRule, CacheRule];

export function rulesetNeedsUpdate(currentRules: CacheRule[], desiredRules?: CacheRule[]): boolean;
