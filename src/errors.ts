export const MaytesErrorCode = {
  Config: 'CONFIG',
} as const;

export type MaytesErrorCodeValue = (typeof MaytesErrorCode)[keyof typeof MaytesErrorCode];

export class MaytesError extends Error {
  readonly code: MaytesErrorCodeValue;

  constructor(code: MaytesErrorCodeValue, message: string) {
    super(message);
    this.code = code;
    this.name = 'MaytesError';
  }
}
