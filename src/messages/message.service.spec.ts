import { MessageRepository } from './message.repository';
import { MessageService } from './message.service';
import { MessageDocument } from './schemas/message.schema';

describe('MessageService', () => {
  const doc = (id: string, text: string) =>
    ({
      id,
      roomId: 'general',
      userId: 'alice',
      text,
      sentAt: new Date('2026-11-19T06:00:00.000Z'),
    }) as MessageDocument;

  let repository: { create: jest.Mock; findPage: jest.Mock };
  let service: MessageService;

  beforeEach(() => {
    repository = { create: jest.fn(), findPage: jest.fn() };
    service = new MessageService(repository as unknown as MessageRepository);
  });

  it('returns the saved message with an iso timestamp', async () => {
    repository.create.mockResolvedValue(doc('m1', 'hello'));

    await expect(service.save('general', 'alice', 'hello')).resolves.toEqual({
      id: 'm1',
      roomId: 'general',
      userId: 'alice',
      text: 'hello',
      sentAt: '2026-11-19T06:00:00.000Z',
    });
    expect(repository.create).toHaveBeenCalledWith('general', 'alice', 'hello');
  });

  it('maps a history page and passes the cursor through', async () => {
    repository.findPage.mockResolvedValue([doc('m2', 'two'), doc('m1', 'one')]);

    const page = await service.history('general', 20, 'm3');

    expect(page.map((m) => m.id)).toEqual(['m2', 'm1']);
    expect(repository.findPage).toHaveBeenCalledWith('general', 20, 'm3');
  });
});
