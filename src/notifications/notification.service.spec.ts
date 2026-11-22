import { ServiceUnavailableException } from '@nestjs/common';
import { NotificationGateway } from './notification.gateway';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  const repository = { createForUsers: jest.fn() };
  const gateway = { deliver: jest.fn() };
  const service = new NotificationService(
    repository as unknown as NotificationRepository,
    gateway as unknown as NotificationGateway
  );

  beforeEach(() => {
    repository.createForUsers.mockReset().mockResolvedValue(undefined);
    gateway.deliver.mockReset();
  });

  it('saves one notification for every user, then delivers it', async () => {
    const notification = await service.notify({
      userIds: ['alice', 'bob'],
      type: 'order.paid',
      data: { orderId: 'o1' },
    });

    expect(notification).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{24}$/),
      type: 'order.paid',
      data: { orderId: 'o1' },
      sentAt: expect.any(String),
    });
    expect(repository.createForUsers).toHaveBeenCalledWith(['alice', 'bob'], notification);
    expect(gateway.deliver).toHaveBeenCalledWith(['alice', 'bob'], notification);
    expect(repository.createForUsers.mock.invocationCallOrder[0]).toBeLessThan(
      gateway.deliver.mock.invocationCallOrder[0]
    );
  });

  it('defaults data to an empty object', async () => {
    expect((await service.notify({ userIds: ['alice'], type: 'ping' })).data).toEqual({});
  });

  it('delivers nothing when the save fails', async () => {
    repository.createForUsers.mockRejectedValue(new Error('mongo down'));

    await expect(service.notify({ userIds: ['alice'], type: 'ping' })).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    expect(gateway.deliver).not.toHaveBeenCalled();
  });
});
