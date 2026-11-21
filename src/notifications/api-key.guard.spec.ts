import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard';

describe('ApiKeyGuard', () => {
  const guard = new ApiKeyGuard({
    getOrThrow: () => 'notify-key-0123456789',
  } as unknown as ConfigService);

  const contextWith = (key?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ header: (name: string) => (name === 'x-api-key' ? key : undefined) }),
      }),
    }) as unknown as ExecutionContext;

  it('lets the configured key through', () => {
    expect(guard.canActivate(contextWith('notify-key-0123456789'))).toBe(true);
  });

  it('rejects a missing, wrong or prefixed key', () => {
    expect(() => guard.canActivate(contextWith())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(contextWith('wrong'))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(contextWith('notify-key-0123456789x'))).toThrow(
      UnauthorizedException
    );
  });
});
