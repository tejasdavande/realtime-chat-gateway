import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class MessageRateLimitService {
  private readonly limit: number;
  private readonly windowSeconds: number;
  private readonly keyPrefix: string;

  constructor(
    private readonly redis: Redis,
    config: ConfigService
  ) {
    this.limit = config.getOrThrow<number>('MESSAGE_RATE_LIMIT');
    this.windowSeconds = config.getOrThrow<number>('MESSAGE_RATE_WINDOW_SECONDS');
    this.keyPrefix = config.getOrThrow<string>('SOCKET_IO_REDIS_KEY');
  }

  async tryConsume(userId: string): Promise<boolean> {
    const key = `${this.keyPrefix}:message-rate:${userId}`;
    let replies: [Error | null, unknown][] | null;

    try {
      replies = await this.redis.multi().incr(key).expire(key, this.windowSeconds, 'NX').exec();
    } catch {
      return true;
    }

    const [error, count] = replies?.[0] ?? [null, null];

    return error !== null || typeof count !== 'number' || count <= this.limit;
  }
}
