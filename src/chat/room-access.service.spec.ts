import { RoomAccessService } from './room-access.service';

describe('RoomAccessService', () => {
  const service = new RoomAccessService();
  const member = { userId: 'm', email: 'm@example.com', role: 'member' };
  const admin = { userId: 'a', email: 'a@example.com', role: 'admin' };

  it('lets anyone join and send in a normal room', () => {
    expect(service.canJoin(member, 'general')).toBe(true);
    expect(service.canSend(member, 'general')).toBe(true);
  });

  it('keeps admin- rooms to admins', () => {
    expect(service.canJoin(member, 'admin-ops')).toBe(false);
    expect(service.canSend(member, 'admin-ops')).toBe(false);
    expect(service.canJoin(admin, 'admin-ops')).toBe(true);
    expect(service.canSend(admin, 'admin-ops')).toBe(true);
  });

  it('lets members join announce- rooms but only admins send', () => {
    expect(service.canJoin(member, 'announce-news')).toBe(true);
    expect(service.canSend(member, 'announce-news')).toBe(false);
    expect(service.canSend(admin, 'announce-news')).toBe(true);
  });
});
