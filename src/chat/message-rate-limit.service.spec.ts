import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { MessageRateLimitService } from './message-rate-limit.service';

describe('MessageRateLimitService', () => {
  const settings: Record<string, unknown> = {
    MESSAGE_RATE_LIMIT: 3,
    MESSAGE_RATE_WINDOW_SECONDS: 10,
    SOCKET_IO_REDIS_KEY: 'chat',
  };
  const config = { getOrThrow: (key: string) => settings[key] } as unknown as ConfigService;

  let transaction: { incr: jest.Mock; expire: jest.Mock; exec: jest.Mock };
  let service: MessageRateLimitService;

  beforeEach(() => {
    transaction = { incr: jest.fn(), expire: jest.fn(), exec: jest.fn() };
    transaction.incr.mockReturnValue(transaction);
    transaction.expire.mockReturnValue(transaction);
    const redis = { multi: () => transaction } as unknown as Redis;
    service = new MessageRateLimitService(redis, config);
  });

  it('counts per user and starts the window only on the first message', async () => {
    transaction.exec.mockResolvedValue([
      [null, 1],
      [null, 1],
    ]);

    await expect(service.tryConsume('alice')).resolves.toBe(true);
    expect(transaction.incr).toHaveBeenCalledWith('chat:message-rate:alice');
    expect(transaction.expire).toHaveBeenCalledWith('chat:message-rate:alice', 10, 'NX');
  });

  it('allows up to the limit and refuses after it', async () => {
    transaction.exec.mockResolvedValueOnce([
      [null, 3],
      [null, 0],
    ]);
    transaction.exec.mockResolvedValueOnce([
      [null, 4],
      [null, 0],
    ]);

    await expect(service.tryConsume('alice')).resolves.toBe(true);
    await expect(service.tryConsume('alice')).resolves.toBe(false);
  });

  it('lets messages through when redis is unavailable', async () => {
    transaction.exec.mockRejectedValue(new Error("Stream isn't writeable"));

    await expect(service.tryConsume('alice')).resolves.toBe(true);
  });
});
