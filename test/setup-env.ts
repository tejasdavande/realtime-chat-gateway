import { randomUUID } from 'crypto';

process.env.SOCKET_IO_REDIS_KEY = `socket.io-e2e-${randomUUID()}`;
