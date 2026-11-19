import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';

interface HistoryMessage {
  id: string;
  roomId: string;
  userId: string;
  text: string;
  sentAt: string;
}

describe('Chat history (e2e)', () => {
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

  const connect = (instance: number, userId: string) => {
    const token = new JwtService({ secret: process.env.JWT_SECRET }).sign(
      { sub: userId, email: `${userId}@example.com`, role: 'member', token_use: 'access' },
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

  const sendMessages = async (socket: Socket, roomId: string, count: number) => {
    for (let i = 1; i <= count; i++) {
      await socket.emitWithAck('message:send', { roomId, text: `message ${i}` });
    }
  };

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

  it('gives a late joiner on another instance the earlier messages, newest first', async () => {
    const roomId = randomUUID();
    const alice = await connect(0, 'alice');
    await alice.emitWithAck('room:join', { roomId });
    await sendMessages(alice, roomId, 3);

    const bob = await connect(1, 'bob');
    await bob.emitWithAck('room:join', { roomId });
    const history: HistoryMessage[] = await bob.emitWithAck('room:history', { roomId });

    expect(history.map((m) => m.text)).toEqual(['message 3', 'message 2', 'message 1']);
    expect(history[0]).toMatchObject({ roomId, userId: 'alice' });
    expect(new Date(history[0].sentAt).getTime()).not.toBeNaN();
  });

  it('acks the saved message with the same id it broadcasts', async () => {
    const roomId = randomUUID();
    const alice = await connect(0, 'alice');
    await alice.emitWithAck('room:join', { roomId });

    const broadcast = nextEvent<HistoryMessage>(alice, 'message:new');
    const acked: HistoryMessage = await alice.emitWithAck('message:send', { roomId, text: 'hi' });
    const history: HistoryMessage[] = await alice.emitWithAck('room:history', { roomId });

    expect((await broadcast).id).toBe(acked.id);
    expect(history.map((m) => m.id)).toEqual([acked.id]);
  });

  it('pages back with before and limit', async () => {
    const roomId = randomUUID();
    const alice = await connect(0, 'alice');
    await alice.emitWithAck('room:join', { roomId });
    await sendMessages(alice, roomId, 5);

    const first: HistoryMessage[] = await alice.emitWithAck('room:history', { roomId, limit: 2 });
    const second: HistoryMessage[] = await alice.emitWithAck('room:history', {
      roomId,
      limit: 2,
      before: first[1].id,
    });
    const last: HistoryMessage[] = await alice.emitWithAck('room:history', {
      roomId,
      limit: 2,
      before: second[1].id,
    });

    expect(first.map((m) => m.text)).toEqual(['message 5', 'message 4']);
    expect(second.map((m) => m.text)).toEqual(['message 3', 'message 2']);
    expect(last.map((m) => m.text)).toEqual(['message 1']);
  });

  it('keeps rooms apart', async () => {
    const quiet = randomUUID();
    const busy = randomUUID();
    const alice = await connect(0, 'alice');
    await alice.emitWithAck('room:join', { roomId: busy });
    await alice.emitWithAck('room:join', { roomId: quiet });
    await sendMessages(alice, busy, 2);

    expect(await alice.emitWithAck('room:history', { roomId: quiet })).toEqual([]);
  });

  it('refuses history for a room the socket has not joined', async () => {
    const roomId = randomUUID();
    const alice = await connect(0, 'alice');
    await alice.emitWithAck('room:join', { roomId });
    await sendMessages(alice, roomId, 1);
    const mallory = await connect(1, 'mallory');

    const error = nextEvent(mallory, 'exception');
    mallory.emit('room:history', { roomId });

    expect(await error).toMatchObject({ status: 'error', message: 'not in room' });
  });

  it.each([
    ['a bad cursor', { roomId: 'general', before: 'nope' }],
    ['a limit of 0', { roomId: 'general', limit: 0 }],
    ['a limit over 100', { roomId: 'general', limit: 101 }],
  ])('rejects %s', async (_name, payload) => {
    const alice = await connect(0, 'alice');

    const error = nextEvent(alice, 'exception');
    alice.emit('room:history', payload);

    expect(await error).toMatchObject({ status: 'error', message: 'invalid payload' });
  });
});
