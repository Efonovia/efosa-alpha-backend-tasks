import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { SampleCandidate } from '../entities/sample-candidate.entity';
import { QueueService } from '../queue/queue.service';
import { SummariesService } from './summaries.service';

describe('SummariesService', () => {
  let service: SummariesService;
  let queueService: QueueService;

  const summariesRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const candidatesRepository = {
    findOne: jest.fn(),
  };

  const documentsRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SummariesService,
        {
          provide: QueueService,
          useValue: { enqueue: jest.fn() },
        },
        {
          provide: getRepositoryToken(CandidateSummary),
          useValue: summariesRepository,
        },
        {
          provide: getRepositoryToken(SampleCandidate),
          useValue: candidatesRepository,
        },
        {
          provide: getRepositoryToken(CandidateDocument),
          useValue: documentsRepository,
        },
      ],
    }).compile();

    service = module.get<SummariesService>(SummariesService);
    queueService = module.get<QueueService>(QueueService);
  });

  describe('requestSummaryGeneration', () => {
    it('throws if candidate is not found', async () => {
      candidatesRepository.findOne.mockResolvedValue(null);
      await expect(
        service.requestSummaryGeneration({ userId: 'u1', workspaceId: 'w1' }, 'c1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates pending summary and enqueues job', async () => {
      candidatesRepository.findOne.mockResolvedValue({ id: 'c1', workspaceId: 'w1' });
      documentsRepository.find.mockResolvedValue([{ id: 'doc1' }]);
      summariesRepository.create.mockImplementation((val) => val);
      summariesRepository.save.mockImplementation(async (val) => val);

      const res = await service.requestSummaryGeneration(
        { userId: 'u1', workspaceId: 'w1' },
        'c1',
      );

      expect(summariesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ candidateId: 'c1', status: 'pending' }),
      );
      expect(queueService.enqueue).toHaveBeenCalledWith('generate_summary', {
        candidateId: 'c1',
        summaryId: res.summaryId,
      });
      expect(res.message).toBe('Summary generation enqueued successfully');
    });
  });
});
