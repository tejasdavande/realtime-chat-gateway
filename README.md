# realtime-chat-gateway

Real-time chat and notifications service on NestJS and Socket.io. Redis pub/sub lets it scale out to several instances, and JWT/RBAC gate the rooms.

Work in progress.

## Quick start

```
docker compose up -d redis mongo
cp .env.example .env
npm install
npm run start:dev
```

`GET /health` returns `{"status":"ok","mongo":"up","redis":"up"}`, or 503 when either is down.

## Connecting

Clients connect with Socket.io and pass an access token from auth-gateway-service in the handshake:

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', { auth: { token: accessToken } });
socket.on('connect_error', (err) => console.log(err.message)); // "unauthorized"
```

The token is checked against `JWT_SECRET` (HS256, the same secret auth-gateway-service signs with). A missing, forged or expired token fails the handshake with `unauthorized`, so the socket never connects.

Every instance uses the Socket.io Redis adapter, so a broadcast from one instance reaches sockets connected to any other.

## Events

| Event | Payload | Notes |
|---|---|---|
| `room:join` | `{ roomId }` | acks `{ roomId }`. `roomId` is 1-64 chars of `A-Za-z0-9_-` |
| `room:leave` | `{ roomId }` | acks `{ roomId }` |
| `message:send` | `{ roomId, text }` | text is 1-2000 chars, the socket must have joined the room. Saves the message to MongoDB, acks it and broadcasts `message:new` to the room |
| `room:history` | `{ roomId, before?, limit? }` | the socket must have joined the room. Acks messages newest first (`limit` 1-100, default 50); pass the oldest `id` you have as `before` to get the next page |

A bad payload or sending into a room you haven't joined makes the server emit `exception` with `{ status: 'error', message }`.

## Tests

```
npm test
npm run test:e2e
```

The e2e tests need Redis on `REDIS_HOST:REDIS_PORT` and MongoDB on `MONGO_URI`.

## License

MIT
