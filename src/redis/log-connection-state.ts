import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { errorReason } from '../common/error-reason';

export function logConnectionState(client: Redis, logger: Logger, name: string) {
  let down = false;

  client.on('error', (error: Error) => {
    if (down) {
      return;
    }

    down = true;
    logger.warn(`${name} connection lost: ${errorReason(error)}`);
  });

  client.on('ready', () => {
    if (!down) {
      return;
    }

    down = false;
    logger.log(`${name} reconnected`);
  });
}
