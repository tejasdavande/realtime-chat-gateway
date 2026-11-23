import 'reflect-metadata';
import { validate } from './env.validator';

describe('validate', () => {
  const base = {
    PORT: '3000',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
    MONGO_URI: 'mongodb://localhost:27017/chat',
    JWT_SECRET: 'secret',
    NOTIFY_API_KEY: 'notify-key-0123456789',
  };

  it('converts PORT and REDIS_PORT to numbers', () => {
    const env = validate(base);

    expect(env.PORT).toBe(3000);
    expect(env.REDIS_PORT).toBe(6379);
  });

  it('defaults SOCKET_IO_REDIS_KEY and rejects one with spaces or over 64 chars', () => {
    expect(validate(base).SOCKET_IO_REDIS_KEY).toBe('socket.io');
    expect(validate({ ...base, SOCKET_IO_REDIS_KEY: 'chat-staging' }).SOCKET_IO_REDIS_KEY).toBe(
      'chat-staging'
    );
    expect(() => validate({ ...base, SOCKET_IO_REDIS_KEY: 'has space' })).toThrow();
    expect(() => validate({ ...base, SOCKET_IO_REDIS_KEY: 'k'.repeat(65) })).toThrow();
  });

  it('rejects a missing REDIS_HOST', () => {
    expect(() => validate({ ...base, REDIS_HOST: undefined })).toThrow();
  });

  it('rejects an empty JWT_SECRET', () => {
    expect(() => validate({ ...base, JWT_SECRET: '' })).toThrow();
  });

  it('rejects a missing or short NOTIFY_API_KEY', () => {
    expect(() => validate({ ...base, NOTIFY_API_KEY: undefined })).toThrow();
    expect(() => validate({ ...base, NOTIFY_API_KEY: 'short' })).toThrow();
  });

  it('rejects a MONGO_URI that is not a mongodb url', () => {
    expect(() => validate({ ...base, MONGO_URI: undefined })).toThrow();
    expect(() => validate({ ...base, MONGO_URI: 'localhost:27017' })).toThrow();
    expect(() =>
      validate({ ...base, MONGO_URI: 'mongodb+srv://cluster.example.net/chat' })
    ).not.toThrow();
  });

  it('rejects an out of range REDIS_PORT', () => {
    expect(() => validate({ ...base, REDIS_PORT: '0' })).toThrow();
    expect(() => validate({ ...base, REDIS_PORT: '70000' })).toThrow();
  });
});
