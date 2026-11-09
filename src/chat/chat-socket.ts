import { DefaultEventsMap, Server, Socket } from 'socket.io';
import { AuthenticatedUser } from '../auth/authenticated-user';

export interface ChatSocketData {
  user: AuthenticatedUser;
}

export type ChatServer = Server<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  ChatSocketData
>;
export type ChatSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  ChatSocketData
>;
