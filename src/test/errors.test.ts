import { describe, it, expect } from 'vitest';
import { MaytesError, MaytesErrorCode } from '../errors.js';

describe('MaytesError', () => {
  it('is an instance of Error', () => {
    const err = new MaytesError(MaytesErrorCode.Config, 'whoops');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(MaytesError);
  });

  it('carries the code as a readonly field', () => {
    const err = new MaytesError(MaytesErrorCode.Config, 'whoops');
    expect(err.code).toBe('CONFIG');
  });

  it('carries the human message', () => {
    const err = new MaytesError(MaytesErrorCode.Config, 'createCheckout missing');
    expect(err.message).toBe('createCheckout missing');
  });

  it('sets the name to "MaytesError" (not "Error")', () => {
    const err = new MaytesError(MaytesErrorCode.Config, 'x');
    expect(err.name).toBe('MaytesError');
  });

  it('has a stack trace', () => {
    const err = new MaytesError(MaytesErrorCode.Config, 'x');
    expect(typeof err.stack).toBe('string');
    expect(err.stack?.length).toBeGreaterThan(0);
  });

  it('serializes the message via toString', () => {
    const err = new MaytesError(MaytesErrorCode.Config, 'bad input');
    expect(String(err)).toContain('MaytesError');
    expect(String(err)).toContain('bad input');
  });
});

describe('MaytesErrorCode', () => {
  it('exposes Config as the CONFIG literal', () => {
    expect(MaytesErrorCode.Config).toBe('CONFIG');
  });

  it('is the only public code today (no TIMEOUT / INVALID_MESSAGE)', () => {
    expect(Object.keys(MaytesErrorCode)).toEqual(['Config']);
  });
});
