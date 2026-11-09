import 'reflect-metadata';
import { validate } from './env.validator';

describe('validate', () => {
  const base = { PORT: '3000', REDIS_HOST: 'localhost', REDIS_PORT: '6379', JWT_SECRET: 'secret' };

  it('converts PORT and REDIS_PORT to numbers', () => {
    const env = validate(base);

    expect(env.PORT).toBe(3000);
    expect(env.REDIS_PORT).toBe(6379);
  });

  it('rejects a missing REDIS_HOST', () => {
    expect(() => validate({ ...base, REDIS_HOST: undefined })).toThrow();
  });

  it('rejects an empty JWT_SECRET', () => {
    expect(() => validate({ ...base, JWT_SECRET: '' })).toThrow();
  });

  it('rejects an out of range REDIS_PORT', () => {
    expect(() => validate({ ...base, REDIS_PORT: '0' })).toThrow();
    expect(() => validate({ ...base, REDIS_PORT: '70000' })).toThrow();
  });
});
