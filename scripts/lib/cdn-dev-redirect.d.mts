export const DEV_PREVIEW_ORIGIN: string;

export interface DevRedirectRule {
  id: string;
  expression: string;
  targetUrlExpression: string;
  statusCode: number;
}

export const DEV_REDIRECT_RULE: DevRedirectRule;

export function redirectNeedsUpdate(currentRule: DevRedirectRule | undefined, desiredRule?: DevRedirectRule): boolean;
