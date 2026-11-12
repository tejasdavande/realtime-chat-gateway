import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SocketAuthService } from './socket-auth.service';

describe('SocketAuthService', () => {
  const secret = 'test-secret';
  const signer = new JwtService({ secret });
  const service = new SocketAuthService(
    new JwtService({ secret, verifyOptions: { algorithms: ['HS256'] } })
  );
  const claims = { sub: 'user-1', email: 'a@example.com', role: 'member', token_use: 'access' };

  it('returns the user from a valid token', async () => {
    const token = signer.sign(claims, { expiresIn: '1m' });

    await expect(service.authenticate(token)).resolves.toEqual({
      userId: 'user-1',
      email: 'a@example.com',
      role: 'member',
    });
  });

  it.each([undefined, '', 42])('rejects a missing token (%p)', async (token) => {
    await expect(service.authenticate(token)).rejects.toThrow(
      new UnauthorizedException('missing token')
    );
  });

  it('rejects a token signed with another secret', async () => {
    const token = new JwtService({ secret: 'other' }).sign(claims);

    await expect(service.authenticate(token)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an expired token', async () => {
    const token = signer.sign({ ...claims, exp: Math.floor(Date.now() / 1000) - 10 });

    await expect(service.authenticate(token)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an unsigned token', async () => {
    const encode = (part: object) => Buffer.from(JSON.stringify(part)).toString('base64url');
    const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode(claims)}.`;

    await expect(service.authenticate(token)).rejects.toThrow(UnauthorizedException);
  });

  it.each([{ token_use: 'refresh' }, { token_use: undefined }])(
    'rejects a token that is not an access token (%p)',
    async (override) => {
      const token = signer.sign({ ...claims, ...override });

      await expect(service.authenticate(token)).rejects.toThrow(
        new UnauthorizedException('invalid token')
      );
    }
  );

  it('rejects a token without the expected claims', async () => {
    const token = signer.sign({ sub: 'user-1' });

    await expect(service.authenticate(token)).rejects.toThrow(
      new UnauthorizedException('invalid token')
    );
  });
});
