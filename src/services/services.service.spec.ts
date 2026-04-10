import { BadRequestException } from '@nestjs/common';
import { ServicesService } from './services.service';

const mockPrisma = {
  service: {
    findMany: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  serviceType: {
    findUnique: jest.fn(),
  },
  serviceVariation: {
    deleteMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

const mockEventPublisher = {
  publishServiceEvent: jest.fn(),
};

describe('ServicesService', () => {
  let service: ServicesService;

  beforeEach(() => {
    service = new ServicesService(
      mockPrisma as any,
      mockLogger as any,
      mockEventPublisher as any,
    );
    jest.clearAllMocks();
  });

  describe('reorder()', () => {
    const orgId = 'org-uuid';

    it('updates sortOrder for all provided service IDs in a single transaction', async () => {
      mockPrisma.service.findMany.mockResolvedValue([
        { id: 'svc-1' },
        { id: 'svc-2' },
      ]);
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.reorder(orgId, {
        items: [
          { id: 'svc-1', sortOrder: 1 },
          { id: 'svc-2', sortOrder: 2 },
        ],
      });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException when any service ID does not belong to the organization', async () => {
      mockPrisma.service.findMany.mockResolvedValue([{ id: 'svc-1' }]); // only 1 found, 2 requested

      await expect(
        service.reorder(orgId, {
          items: [
            { id: 'svc-1', sortOrder: 1 },
            { id: 'svc-unknown', sortOrder: 2 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('only updates services mentioned in the payload, leaves others unchanged', async () => {
      mockPrisma.service.findMany.mockResolvedValue([{ id: 'svc-1' }]);
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.reorder(orgId, { items: [{ id: 'svc-1', sortOrder: 5 }] });

      // Transaction array should only contain updates for svc-1
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.arrayContaining([expect.anything()]),
      );
      expect(mockPrisma.$transaction.mock.calls[0][0]).toHaveLength(1);
    });

    it('handles empty items array without throwing', async () => {
      await expect(
        service.reorder(orgId, { items: [] }),
      ).resolves.toBeUndefined();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
