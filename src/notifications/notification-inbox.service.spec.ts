import { Types } from 'mongoose';
import { NotificationInboxService } from './notification-inbox.service';
import { NotificationRepository } from './notification.repository';
import { UserNotificationDocument } from './schemas/notification.schema';

describe('NotificationInboxService', () => {
  const repository = { findUnread: jest.fn(), markRead: jest.fn() };
  const service = new NotificationInboxService(repository as unknown as NotificationRepository);

  const doc = (id: string, type: string) =>
    ({
      notificationId: new Types.ObjectId(id),
      type,
      data: { orderId: 'o1' },
      sentAt: new Date('2026-11-22T06:00:00.000Z'),
    }) as unknown as UserNotificationDocument;

  beforeEach(() => {
    repository.findUnread.mockReset();
    repository.markRead.mockReset();
  });

  it('maps unread notifications and passes the cursor through', async () => {
    const newer = '6740a1b2c3d4e5f601234568';
    const older = '6740a1b2c3d4e5f601234567';
    repository.findUnread.mockResolvedValue([doc(newer, 'order.paid'), doc(older, 'ping')]);

    await expect(service.unread('alice', 20, '6740a1b2c3d4e5f601234569')).resolves.toEqual([
      {
        id: newer,
        type: 'order.paid',
        data: { orderId: 'o1' },
        sentAt: '2026-11-22T06:00:00.000Z',
      },
      { id: older, type: 'ping', data: { orderId: 'o1' }, sentAt: '2026-11-22T06:00:00.000Z' },
    ]);
    expect(repository.findUnread).toHaveBeenCalledWith('alice', 20, '6740a1b2c3d4e5f601234569');
  });

  it('marks read only for the given user', async () => {
    repository.markRead.mockResolvedValue(2);

    await expect(service.markRead('alice', ['a', 'b'])).resolves.toBe(2);
    expect(repository.markRead).toHaveBeenCalledWith('alice', ['a', 'b']);
  });
});
