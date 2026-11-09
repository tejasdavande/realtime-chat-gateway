import { Global, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import Redis from 'ioredis';
import { logConnectionState } from './log-connection-state';

@Global()
@Module({
  providers: [
    {
      provide: Redis,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = new Redis({
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
        });
        logConnectionState(redis, new Logger(RedisModule.name), 'redis');

        return redis;
      },
    },
  ],
  exports: [Redis],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onApplicationShutdown(): Promise<void> {
    const redis = this.moduleRef.get(Redis);

    if (redis.status === 'ready') {
      await redis.quit();
      return;
    }

    redis.disconnect();
  }
}
