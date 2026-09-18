export interface CacheRule {
  id: string;
  expression: string;
  edgeTtl: number;
  browserTtl: number;
}

export const CACHE_RULES: [CacheRule, CacheRule];

export function rulesetNeedsUpdate(currentRules: CacheRule[], desiredRules?: CacheRule[]): boolean;
