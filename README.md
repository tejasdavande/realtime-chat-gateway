# realtime-chat-gateway

Real-time chat and notifications service on NestJS and Socket.io. Redis pub/sub lets it scale out to several instances, and JWT/RBAC gate the rooms.

Work in progress.

## Quick start

```
docker compose up -d redis
cp .env.example .env
npm install
npm run start:dev
```

`GET /health` returns `{"status":"ok","redis":"up"}`, or 503 when Redis is down.

## Tests

```
npm test
npm run test:e2e
```

The e2e tests need Redis on `REDIS_HOST:REDIS_PORT`.

## License

MIT
