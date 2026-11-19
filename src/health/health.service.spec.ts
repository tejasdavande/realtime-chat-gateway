import { ServiceUnavailableException } from '@nestjs/common';
import Redis from 'ioredis';
import { Connection, ConnectionStates } from 'mongoose';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let ping: jest.Mock;
  let connection: { readyState: ConnectionStates };
  let service: HealthService;

  beforeEach(() => {
    ping = jest.fn().mockResolvedValue('PONG');
    connection = { readyState: ConnectionStates.connected };
    service = new HealthService({ ping } as unknown as Redis, connection as unknown as Connection);
  });

  it('reports ok when redis answers', async () => {
    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      mongo: 'up',
      redis: 'up',
    });
  });

  it('throws 503 when mongo is not connected', async () => {
    connection.readyState = ConnectionStates.disconnected;

    await expect(service.check()).rejects.toThrow(
      new ServiceUnavailableException('mongo is not connected')
    );
    expect(ping).not.toHaveBeenCalled();
  });

  it('throws 503 when the ping fails', async () => {
    ping.mockRejectedValue(
      new Error("Stream isn't writeable and enableOfflineQueue options is false")
    );

    await expect(service.check()).rejects.toThrow(
      new ServiceUnavailableException('redis is not reachable')
    );
  });

  it('throws 503 instead of hanging when the ping never returns', async () => {
    jest.useFakeTimers();
    ping.mockReturnValue(new Promise(() => undefined));

    const result = service.check();
    const assertion = expect(result).rejects.toThrow(ServiceUnavailableException);
    await jest.advanceTimersByTimeAsync(1000);
    await assertion;

    jest.useRealTimers();
  });
});
