import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: Redis,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
        }),
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
