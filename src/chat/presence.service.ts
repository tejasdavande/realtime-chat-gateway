import { Injectable } from '@nestjs/common';
import { ChatServer } from './chat-socket';
import { roomName } from './room-name';

@Injectable()
export class PresenceService {
  async members(server: ChatServer, roomId: string): Promise<string[]> {
    const sockets = await server.in(roomName(roomId)).fetchSockets();

    return [...new Set(sockets.map((socket) => socket.data.user.userId))].sort();
  }

  async hasOtherSocket(
    server: ChatServer,
    roomId: string,
    userId: string,
    socketId: string
  ): Promise<boolean> {
    const sockets = await server.in(roomName(roomId)).fetchSockets();

    return sockets.some((socket) => socket.id !== socketId && socket.data.user.userId === userId);
  }
}
