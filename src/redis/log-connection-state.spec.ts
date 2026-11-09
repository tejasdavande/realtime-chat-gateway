import { Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { logConnectionState } from './log-connection-state';

describe('logConnectionState', () => {
  let client: EventEmitter;
  let logger: { warn: jest.Mock; log: jest.Mock };

  beforeEach(() => {
    client = new EventEmitter();
    logger = { warn: jest.fn(), log: jest.fn() };
    logConnectionState(client as unknown as Redis, logger as unknown as Logger, 'redis');
  });

  it('warns once per outage and logs the recovery', () => {
    const refused = Object.assign(new Error(''), { code: 'ECONNREFUSED' });

    client.emit('error', refused);
    client.emit('error', refused);
    client.emit('ready');
    client.emit('error', refused);

    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith('redis connection lost: ECONNREFUSED');
    expect(logger.log).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith('redis reconnected');
  });

  it('stays quiet on the first ready', () => {
    client.emit('ready');

    expect(logger.log).not.toHaveBeenCalled();
  });
});
