import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser } from './authenticated-user';

interface JwtPayload {
  sub?: unknown;
  email?: unknown;
  role?: unknown;
}

@Injectable()
export class SocketAuthService {
  constructor(private readonly jwt: JwtService) {}

  async authenticate(token: unknown): Promise<AuthenticatedUser> {
    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException('missing token');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('invalid token');
    }

    const { sub, email, role } = payload;
    if (typeof sub !== 'string' || typeof email !== 'string' || typeof role !== 'string') {
      throw new UnauthorizedException('invalid token');
    }

    return { userId: sub, email, role };
  }
}
