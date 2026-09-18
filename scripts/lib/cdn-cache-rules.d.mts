export interface CacheRule {
  id: string;
  expression: string;
  cacheControl: string;
}

export const CACHE_RULES: [CacheRule, CacheRule];

export function rulesetNeedsUpdate(currentRules: CacheRule[], desiredRules?: CacheRule[]): boolean;
