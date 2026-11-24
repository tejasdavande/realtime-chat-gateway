import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';

describe('Chat rooms (e2e)', () => {
  const apps: INestApplication[] = [];
  const urls: string[] = [];
  const sockets: Socket[] = [];

  const startApp = async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    setupApp(app);
    await app.listen(0);
    apps.push(app);
    urls.push(await app.getUrl());
  };

  const connect = (instance: number, userId: string, role = 'member') => {
    const token = new JwtService({ secret: process.env.JWT_SECRET }).sign(
      { sub: userId, email: `${userId}@example.com`, role, token_use: 'access' },
      { expiresIn: '1m' }
    );
    const socket = io(urls[instance], {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
    sockets.push(socket);

    return new Promise<Socket>((resolve, reject) => {
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  };

  const nextEvent = <T>(socket: Socket, event: string, timeoutMs = 2000) =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no ${event}`)), timeoutMs);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

  const noEvent = (socket: Socket, event: string, waitMs = 400) =>
    new Promise<boolean>((resolve) => {
      const onEvent = () => resolve(false);
      socket.once(event, onEvent);
      setTimeout(() => {
        socket.off(event, onEvent);
        resolve(true);
      }, waitMs);
    });

  beforeAll(async () => {
    await startApp();
    await startApp();
  });

  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.disconnect());
  });

  afterAll(async () => {
    await Promise.all(apps.map((app) => app.close()));
  });

  it('delivers a message to members of the room on another instance', async () => {
    const roomId = randomUUID();
    const alice = await connect(0, 'alice');
    const bob = await connect(1, 'bob');
    await alice.emitWithAck('room:join', { roomId });
    await bob.emitWithAck('room:join', { roomId });

    const received = nextEvent<{ text: string; userId: string }>(bob, 'message:new');
    await alice.emitWithAck('message:send', { roomId, text: 'hello' });

    expect(await received).toMatchObject({ roomId, text: 'hello', userId: 'alice' });
  });

  it('does not deliver to sockets outside the room', async () => {
    const roomId = randomUUID();
    const alice = await connect(0, 'alice');
    const carol = await connect(1, 'carol');
    await alice.emitWithAck('room:join', { roomId });

    const silent = noEvent(carol, 'message:new');
    await alice.emitWithAck('message:send', { roomId, text: 'hello' });

    expect(await silent).toBe(true);
  });

  it('stops delivering after leaving the room', async () => {
    const roomId = randomUUID();
    const alice = await connect(0, 'alice');
    const bob = await connect(1, 'bob');
    await alice.emitWithAck('room:join', { roomId });
    await bob.emitWithAck('room:join', { roomId });
    await bob.emitWithAck('room:leave', { roomId });

    const silent = noEvent(bob, 'message:new');
    await alice.emitWithAck('message:send', { roomId, text: 'hello' });

    expect(await silent).toBe(true);
  });

  it('refuses to send into a room the socket has not joined', async () => {
    const alice = await connect(0, 'alice');

    const error = nextEvent(alice, 'exception');
    alice.emit('message:send', { roomId: randomUUID(), text: 'hi' });

    expect(await error).toMatchObject({ status: 'error', message: 'not in room' });
  });

  it('refuses members joining an admin- room and lets admins in', async () => {
    const roomId = `admin-${randomUUID()}`;
    const member = await connect(0, 'mallory');
    const admin = await connect(1, 'root', 'admin');

    const error = nextEvent(member, 'exception');
    member.emit('room:join', { roomId });
    expect(await error).toMatchObject({ status: 'error', message: 'forbidden' });

    expect(await admin.emitWithAck('room:join', { roomId })).toEqual({ roomId });
  });

  it('lets members read an announce- room but not post to it', async () => {
    const roomId = `announce-${randomUUID()}`;
    const member = await connect(0, 'reader');
    const admin = await connect(1, 'root', 'admin');
    await member.emitWithAck('room:join', { roomId });
    await admin.emitWithAck('room:join', { roomId });

    const error = nextEvent(member, 'exception');
    member.emit('message:send', { roomId, text: 'hi' });
    expect(await error).toMatchObject({ status: 'error', message: 'forbidden' });

    const received = nextEvent<{ text: string }>(member, 'message:new');
    await admin.emitWithAck('message:send', { roomId, text: 'maintenance at 5' });
    expect(await received).toMatchObject({ text: 'maintenance at 5' });
  });

  it('rate limits a user across instances and leaves other users alone', async () => {
    const roomId = randomUUID();
    const userId = randomUUID();
    const onFirst = await connect(0, userId);
    const onSecond = await connect(1, userId);
    const other = await connect(0, randomUUID());
    await onFirst.emitWithAck('room:join', { roomId });
    await onSecond.emitWithAck('room:join', { roomId });
    await other.emitWithAck('room:join', { roomId });

    for (let i = 0; i < 20; i++) {
      const socket = i % 2 === 0 ? onFirst : onSecond;
      await socket.emitWithAck('message:send', { roomId, text: `message ${i}` });
    }

    const error = nextEvent(onSecond, 'exception');
    onSecond.emit('message:send', { roomId, text: 'one too many' });
    expect(await error).toMatchObject({ status: 'error', message: 'rate limited' });

    const history: unknown[] = await other.emitWithAck('room:history', { roomId, limit: 100 });
    expect(history).toHaveLength(20);
    expect(await other.emitWithAck('message:send', { roomId, text: 'hi' })).toMatchObject({
      text: 'hi',
    });

    const ttl = await apps[0]
      .get(Redis)
      .ttl(`${process.env.SOCKET_IO_REDIS_KEY}:message-rate:${userId}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(10);
  });

  it.each([
    ['a bad room id', { roomId: 'no spaces allowed', text: 'hi' }],
    ['empty text', { roomId: 'general', text: '' }],
    ['text over 2000 chars', { roomId: 'general', text: 'x'.repeat(2001) }],
  ])('rejects %s', async (_name, payload) => {
    const alice = await connect(0, 'alice');

    const error = nextEvent(alice, 'exception');
    alice.emit('message:send', payload);

    expect(await error).toMatchObject({ status: 'error', message: 'invalid payload' });
  });
});
