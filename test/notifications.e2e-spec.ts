import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { io, Socket } from 'socket.io-client';
import { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserNotification } from '../src/notifications/schemas/notification.schema';
import { setupApp } from '../src/setup-app';

describe('Notifications (e2e)', () => {
  const apps: INestApplication[] = [];
  const urls: string[] = [];
  const sockets: Socket[] = [];
  const apiKey = process.env.NOTIFY_API_KEY as string;

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

  const notify = (body: object, key = apiKey) =>
    request(urls[0]).post('/notifications').set('x-api-key', key).send(body);

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

  it('delivers to every socket of the user on any instance, and only to them', async () => {
    const userId = randomUUID();
    const phone = await connect(0, userId);
    const laptop = await connect(1, userId);
    const someoneElse = await connect(1, randomUUID());

    const onPhone = nextEvent(phone, 'notification');
    const onLaptop = nextEvent(laptop, 'notification');
    const quiet = noEvent(someoneElse, 'notification');

    const res = await notify({
      userIds: [userId],
      type: 'order.paid',
      data: { orderId: 'o1' },
    }).expect(202);

    const expected = {
      id: res.body.id,
      type: 'order.paid',
      data: { orderId: 'o1' },
      sentAt: expect.any(String),
    };
    expect(await onPhone).toEqual(expected);
    expect(await onLaptop).toEqual(expected);
    expect(await quiet).toBe(true);
  });

  it('sends one copy to a socket even when listed with other users', async () => {
    const alice = randomUUID();
    const bob = randomUUID();
    const aliceSocket = await connect(1, alice);
    const bobSocket = await connect(0, bob);
    const received: unknown[] = [];
    aliceSocket.on('notification', (payload) => received.push(payload));

    const onBob = nextEvent(bobSocket, 'notification');
    await notify({ userIds: [alice, bob, randomUUID()], type: 'ping' }).expect(202);

    await onBob;
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(received).toHaveLength(1);
  });

  it('stores a copy for every user, including users who are offline', async () => {
    const online = randomUUID();
    const offline = randomUUID();
    const socket = await connect(0, online);
    const delivered = nextEvent(socket, 'notification');

    const res = await notify({ userIds: [online, offline], type: 'ping' }).expect(202);
    await delivered;

    const model = apps[0].get<Model<UserNotification>>(getModelToken(UserNotification.name));
    const stored = await model
      .find({ notificationId: res.body.id })
      .sort({ userId: 1 })
      .lean()
      .exec();

    expect(stored.map((doc) => doc.userId)).toEqual([online, offline].sort());
    for (const doc of stored) {
      expect(doc).toMatchObject({ type: 'ping', data: {}, readAt: null });
    }
  });

  it('rejects a missing or wrong api key', async () => {
    await request(urls[0])
      .post('/notifications')
      .send({ userIds: ['a'], type: 'ping' })
      .expect(401);
    await notify({ userIds: ['a'], type: 'ping' }, 'wrong-key').expect(401);
  });

  it('rejects a bad body', async () => {
    await notify({ userIds: [], type: 'ping' }).expect(400);
    await notify({ userIds: ['a', 'a'], type: 'ping' }).expect(400);
    await notify({ userIds: ['a'], type: 'Has Spaces' }).expect(400);
    await notify({ userIds: ['a'], type: 'ping', data: 'text' }).expect(400);
  });
});
