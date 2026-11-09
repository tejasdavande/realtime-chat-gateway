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

## Connecting

Clients connect with Socket.io and pass an access token from auth-gateway-service in the handshake:

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', { auth: { token: accessToken } });
socket.on('connect_error', (err) => console.log(err.message)); // "unauthorized"
```

The token is checked against `JWT_SECRET` (HS256, the same secret auth-gateway-service signs with). A missing, forged or expired token fails the handshake with `unauthorized`, so the socket never connects.

Every instance uses the Socket.io Redis adapter, so a broadcast from one instance reaches sockets connected to any other.

## Tests

```
npm test
npm run test:e2e
```

The e2e tests need Redis on `REDIS_HOST:REDIS_PORT`.

## License

MIT
