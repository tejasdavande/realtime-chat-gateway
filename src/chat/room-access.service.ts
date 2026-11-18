import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user';

const ADMIN_ROLE = 'admin';
const ADMIN_ROOM_PREFIX = 'admin-';
const ANNOUNCE_ROOM_PREFIX = 'announce-';

@Injectable()
export class RoomAccessService {
  canJoin(user: AuthenticatedUser, roomId: string) {
    if (roomId.startsWith(ADMIN_ROOM_PREFIX)) {
      return user.role === ADMIN_ROLE;
    }

    return true;
  }

  canSend(user: AuthenticatedUser, roomId: string) {
    if (roomId.startsWith(ANNOUNCE_ROOM_PREFIX)) {
      return user.role === ADMIN_ROLE;
    }

    return this.canJoin(user, roomId);
  }
}
