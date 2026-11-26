import { Injectable } from '@nestjs/common';
import { ChatServer } from './chat-socket';
import { roomName, userRoom } from './room-name';

@Injectable()
export class PresenceService {
  async members(server: ChatServer, roomId: string): Promise<string[]> {
    const sockets = await server.in(roomName(roomId)).fetchSockets();

    return [...new Set(sockets.map((socket) => socket.data.user.userId))].sort();
  }

  async online(server: ChatServer, userIds: string[]): Promise<string[]> {
    const sockets = await server.in(userIds.map(userRoom)).fetchSockets();
    const online = new Set(sockets.map((socket) => socket.data.user.userId));

    return userIds.filter((userId) => online.has(userId));
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
