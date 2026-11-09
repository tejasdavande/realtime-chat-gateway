import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';

describe('Chat socket auth (e2e)', () => {
  let app: INestApplication;
  let url: string;
  const sockets: Socket[] = [];
  const claims = { sub: 'user-1', email: 'a@example.com', role: 'member' };

  const connect = (token?: string) => {
    const socket = io(url, {
      auth: token === undefined ? {} : { token },
      transports: ['websocket'],
      reconnection: false,
    });
    sockets.push(socket);

    return new Promise<Socket>((resolve, reject) => {
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.listen(0);
    url = await app.getUrl();
  });

  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.disconnect());
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a valid access token', async () => {
    const token = new JwtService({ secret: process.env.JWT_SECRET }).sign(claims, {
      expiresIn: '1m',
    });

    const socket = await connect(token);

    expect(socket.connected).toBe(true);
  });

  it('rejects a handshake without a token', async () => {
    await expect(connect()).rejects.toThrow('unauthorized');
  });

  it('rejects a token signed with another secret', async () => {
    const token = new JwtService({ secret: 'not-the-secret' }).sign(claims);

    await expect(connect(token)).rejects.toThrow('unauthorized');
  });

  it('rejects an expired token', async () => {
    const token = new JwtService({ secret: process.env.JWT_SECRET }).sign({
      ...claims,
      exp: Math.floor(Date.now() / 1000) - 10,
    });

    await expect(connect(token)).rejects.toThrow('unauthorized');
  });
});
