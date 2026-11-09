import { INestApplication, ValidationPipe } from '@nestjs/common';
import { RedisIoAdapter } from './redis/redis-io.adapter';

export function setupApp(app: INestApplication) {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useWebSocketAdapter(new RedisIoAdapter(app));
}
