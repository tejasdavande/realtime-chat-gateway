import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Server, ServerOptions } from 'socket.io';
import { logConnectionState } from './log-connection-state';

export class RedisIoAdapter extends IoAdapter {
  private readonly pubClient: Redis;
  private readonly subClient: Redis;

  constructor(app: INestApplication) {
    super(app);
    const config = app.get(ConfigService);

    this.pubClient = new Redis({
      host: config.getOrThrow<string>('REDIS_HOST'),
      port: config.getOrThrow<number>('REDIS_PORT'),
      maxRetriesPerRequest: null,
    });
    this.subClient = this.pubClient.duplicate();
    const logger = new Logger(RedisIoAdapter.name);
    logConnectionState(this.pubClient, logger, 'redis pub');
    logConnectionState(this.subClient, logger, 'redis sub');
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server: Server = super.createIOServer(port, options);
    server.adapter(createAdapter(this.pubClient, this.subClient));

    return server;
  }

  async dispose(): Promise<void> {
    this.pubClient.disconnect();
    this.subClient.disconnect();
  }
}
