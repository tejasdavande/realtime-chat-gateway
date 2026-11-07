import { ServiceUnavailableException } from '@nestjs/common';
import Redis from 'ioredis';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let ping: jest.Mock;
  let service: HealthService;

  beforeEach(() => {
    ping = jest.fn().mockResolvedValue('PONG');
    service = new HealthService({ ping } as unknown as Redis);
  });

  it('reports ok when redis answers', async () => {
    await expect(service.check()).resolves.toEqual({ status: 'ok', redis: 'up' });
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
