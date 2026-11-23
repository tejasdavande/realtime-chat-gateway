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

Every instance uses the Socket.io Redis adapter, so a broadcast from one instance reaches sockets connected to any other. Its channels are prefixed with `SOCKET_IO_REDIS_KEY` (default `socket.io`); give each deployment its own when several share one Redis, otherwise they receive each other's broadcasts.

## Events

| Event | Payload | Notes |
|---|---|---|
| `room:join` | `{ roomId }` | acks `{ roomId }`. `roomId` is 1-64 chars of `A-Za-z0-9_-` |
| `room:leave` | `{ roomId }` | acks `{ roomId }` |
| `message:send` | `{ roomId, text }` | text is 1-2000 chars, the socket must have joined the room. Saves the message to MongoDB, acks it and broadcasts `message:new` to the room |
| `room:history` | `{ roomId, before?, limit? }` | the socket must have joined the room. Acks messages newest first (`limit` 1-100, default 50); pass the oldest `id` you have as `before` to get the next page |
| `room:members` | `{ roomId }` | the socket must have joined the room. Acks `{ roomId, userIds }`, each user once however many sockets or instances they are on |
| `presence:joined` / `presence:left` | `{ roomId, userId }` | server to room. Only sent when a user's first socket joins or their last socket leaves (leave, disconnect), and not to the sender |
| `notification:unread` | `{ before?, limit? }` | acks the user's unread notifications newest first (`limit` 1-100, default 50); pass the oldest `id` you have as `before` to get the next page |
| `notification:read` | `{ ids }` | 1-100 notification ids. Marks them read for this user only and acks `{ updated }`, the number that were still unread |
| `notification:marked-read` | `{ ids }` | server to the user's other sockets, on any instance, after a `notification:read` that changed something. `ids` are only the ones that were still unread |

Presence is read from the live sockets through the Redis adapter (`fetchSockets`), so nothing is stored. The adapter waits up to 5s for every instance to answer, which is why `room:join` acks first and announces in the background.

A bad payload or sending into a room you haven't joined makes the server emit `exception` with `{ status: 'error', message }`.

## Notifications

Other backend services push notifications to users over HTTP, and every socket the user has open gets them, whichever instance it's connected to:

```
curl -X POST http://localhost:3000/notifications \
  -H 'x-api-key: <NOTIFY_API_KEY>' -H 'content-type: application/json' \
  -d '{"userIds":["<user id>"],"type":"order.paid","data":{"orderId":"..."}}'
```

| Method | Path | Notes |
|---|---|---|
| `POST` | `/notifications` | needs `x-api-key` = `NOTIFY_API_KEY` (401 otherwise). `userIds` 1-1000 unique ids, `type` 1-64 chars of `a-z0-9._:-`, `data` an optional object. Returns 202 `{ id }`, or 503 when it can't be saved |

Sockets get a `notification` event with `{ id, type, data, sentAt }`. Each socket joins a private `user:<userId>` room during the handshake, before `connect` fires, so a notification sent right after connecting isn't missed. Clients can't join those rooms themselves, because `room:join` only accepts plain room ids. A socket listed under several users still gets one copy.

Every notification is saved to Mongo first, one copy per user (`notifications` collection), and only then emitted. If the save fails, the endpoint returns 503 and nothing is sent, so the caller can retry. Copies expire after 30 days through a TTL index on `sentAt`.

A client that was offline catches up after connecting with `notification:unread` and marks what it has shown with `notification:read`. Read state is per user, so marking a notification read on one device also removes it from the unread list on the others, and their open sockets get `notification:marked-read` right away so they can clear their badges without refetching.

## Tests

```
npm test
npm run test:e2e
```

The e2e tests need Redis on `REDIS_HOST:REDIS_PORT` and MongoDB on `MONGO_URI`. Each suite gets its own `SOCKET_IO_REDIS_KEY` (`test/setup-env.ts`), so suites running in parallel on one Redis don't see each other's instances. Without that, `fetchSockets` in one suite waited on the apps of every other suite and stalled when one of them was shutting down.

## License

MIT
