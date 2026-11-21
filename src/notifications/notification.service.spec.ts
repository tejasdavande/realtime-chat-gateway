import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  const gateway = { deliver: jest.fn() };
  const service = new NotificationService(gateway as unknown as NotificationGateway);

  beforeEach(() => gateway.deliver.mockReset());

  it('delivers one notification with an id to every user', () => {
    const notification = service.notify({
      userIds: ['alice', 'bob'],
      type: 'order.paid',
      data: { orderId: 'o1' },
    });

    expect(notification).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      type: 'order.paid',
      data: { orderId: 'o1' },
      sentAt: expect.any(String),
    });
    expect(gateway.deliver).toHaveBeenCalledWith(['alice', 'bob'], notification);
  });

  it('defaults data to an empty object', () => {
    expect(service.notify({ userIds: ['alice'], type: 'ping' }).data).toEqual({});
  });
});
