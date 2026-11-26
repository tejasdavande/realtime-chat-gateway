import { ChatServer } from './chat-socket';
import { PresenceService } from './presence.service';

describe('PresenceService', () => {
  const service = new PresenceService();

  const serverWith = (userIds: string[]) => {
    const fetchSockets = jest
      .fn()
      .mockResolvedValue(userIds.map((userId, i) => ({ id: `s${i}`, data: { user: { userId } } })));
    const server = { in: jest.fn().mockReturnValue({ fetchSockets }) };

    return { server: server as unknown as ChatServer, inRooms: server.in };
  };

  it('looks up the users in their private rooms', async () => {
    const { server, inRooms } = serverWith([]);

    await service.online(server, ['alice', 'bob']);

    expect(inRooms).toHaveBeenCalledWith(['user:alice', 'user:bob']);
  });

  it('returns the online users once each, in the order asked', async () => {
    const { server } = serverWith(['carol', 'alice', 'carol']);

    expect(await service.online(server, ['alice', 'bob', 'carol'])).toEqual(['alice', 'carol']);
  });
});
