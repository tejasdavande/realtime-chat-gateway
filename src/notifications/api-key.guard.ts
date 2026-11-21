import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';

const digest = (value: string) => createHash('sha256').update(value).digest();

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly expected: Buffer;

  constructor(config: ConfigService) {
    this.expected = digest(config.getOrThrow<string>('NOTIFY_API_KEY'));
  }

  canActivate(context: ExecutionContext): boolean {
    const key = context.switchToHttp().getRequest<Request>().header('x-api-key');

    if (!key || !timingSafeEqual(digest(key), this.expected)) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
