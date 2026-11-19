import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import Redis from 'ioredis';
import { Connection, ConnectionStates } from 'mongoose';
import { errorReason } from '../common/error-reason';

export interface HealthStatus {
  status: 'ok';
  mongo: 'up';
  redis: 'up';
}

const PING_TIMEOUT_MS = 1000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly redis: Redis,
    @InjectConnection() private readonly connection: Connection
  ) {}

  async check(): Promise<HealthStatus> {
    if (this.connection.readyState !== ConnectionStates.connected) {
      this.logger.warn('mongo health check failed: not connected');
      throw new ServiceUnavailableException('mongo is not connected');
    }

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('ping timed out')), PING_TIMEOUT_MS);
    });

    try {
      await Promise.race([this.redis.ping(), timeout]);
    } catch (error) {
      this.logger.warn(`redis health check failed: ${errorReason(error)}`);
      throw new ServiceUnavailableException('redis is not reachable');
    } finally {
      clearTimeout(timer);
    }

    return { status: 'ok', mongo: 'up', redis: 'up' };
  }
}
