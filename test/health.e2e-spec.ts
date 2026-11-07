import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();

    const redis = app.get(Redis);
    while (redis.status !== 'ready') {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports redis as up', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body).toEqual({ status: 'ok', redis: 'up' });
  });
});
