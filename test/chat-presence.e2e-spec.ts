import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';

interface PresenceEvent {
  roomId: string;
  userId: string;
}

describe('Chat presence (e2e)', () => {
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

  const noEvent = (socket: Socket, event: string, waitMs = 500) =>
    new Promise<boolean>((resolve) => {
      const onEvent = () => resolve(false);
      socket.once(event, onEvent);
      setTimeout(() => {
        socket.off(event, onEvent);
        resolve(true);
      }, waitMs);
    });

  const join = (socket: Socket, roomId: string) => socket.emitWithAck('room:join', { roomId });

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

  it('tells a room when someone on another instance joins and leaves', async () => {
    const roomId = randomUUID();
    const alice = await connect(0, 'alice');
    await join(alice, roomId);

    const bob = await connect(1, 'bob');
    const joined = nextEvent<PresenceEvent>(alice, 'presence:joined');
    await join(bob, roomId);
    expect(await joined).toEqual({ roomId, userId: 'bob' });

    const left = nextEvent<PresenceEvent>(alice, 'presence:left');
    await bob.emitWithAck('room:leave', { roomId });
    expect(await left).toEqual({ roomId, userId: 'bob' });
  });

  it('lists each member once across instances', async () => {
    const roomId = randomUUID();
    const alice = await connect(0, 'alice');
    const aliceTab = await connect(1, 'alice');
    const bob = await connect(1, 'bob');
    await Promise.all([join(alice, roomId), join(aliceTab, roomId), join(bob, roomId)]);

    expect(await alice.emitWithAck('room:members', { roomId })).toEqual({
      roomId,
      userIds: ['alice', 'bob'],
    });
  });

  it('only announces a user leaving when their last socket goes', async () => {
    const roomId = randomUUID();
    const watcher = await connect(0, 'watcher');
    await join(watcher, roomId);
    const bobPhone = await connect(0, 'bob');
    const bobLaptop = await connect(1, 'bob');
    await join(bobPhone, roomId);
    await join(bobLaptop, roomId);

    const quiet = noEvent(watcher, 'presence:left');
    bobPhone.disconnect();
    expect(await quiet).toBe(true);

    const left = nextEvent<PresenceEvent>(watcher, 'presence:left');
    bobLaptop.disconnect();
    expect(await left).toEqual({ roomId, userId: 'bob' });
  });

  it('does not announce a second join from the same user', async () => {
    const roomId = randomUUID();
    const watcher = await connect(0, 'watcher');
    await join(watcher, roomId);
    const bobPhone = await connect(0, 'bob');
    const first = nextEvent<PresenceEvent>(watcher, 'presence:joined');
    await join(bobPhone, roomId);
    await first;

    const quiet = noEvent(watcher, 'presence:joined');
    const bobLaptop = await connect(1, 'bob');
    await join(bobLaptop, roomId);
    await join(bobLaptop, roomId);
    expect(await quiet).toBe(true);
  });

  it('reports which users are online on any instance', async () => {
    const phoneRoom = randomUUID();
    const laptopRoom = randomUUID();
    const alice = await connect(0, 'alice');
    const bobPhone = await connect(1, 'bob');
    const bobLaptop = await connect(1, 'bob');
    await Promise.all([join(alice, phoneRoom), join(alice, laptopRoom)]);
    await join(bobPhone, phoneRoom);
    await nextEvent(alice, 'presence:joined');
    await join(bobLaptop, laptopRoom);
    await nextEvent(alice, 'presence:joined');
    const ask = () => alice.emitWithAck('users:online', { userIds: ['bob', 'carol', 'alice'] });

    expect(await ask()).toEqual({ online: ['bob', 'alice'] });

    let left = nextEvent(alice, 'presence:left');
    bobPhone.disconnect();
    await left;
    expect(await ask()).toEqual({ online: ['bob', 'alice'] });

    left = nextEvent(alice, 'presence:left');
    bobLaptop.disconnect();
    await left;
    expect(await ask()).toEqual({ online: ['alice'] });
  });

  it('rejects an online check without user ids', async () => {
    const alice = await connect(0, 'alice');
    const error = nextEvent<{ message: string }>(alice, 'exception');
    alice.emit('users:online', { userIds: [] });

    expect((await error).message).toBe('invalid payload');
  });

  it('refuses the member list to sockets outside the room', async () => {
    const roomId = randomUUID();
    const alice = await connect(0, 'alice');
    const error = nextEvent<{ message: string }>(alice, 'exception');
    alice.emit('room:members', { roomId });

    expect((await error).message).toBe('not in room');
  });
});
