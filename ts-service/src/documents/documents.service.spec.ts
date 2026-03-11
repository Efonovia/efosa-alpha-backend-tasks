import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as fs from 'fs/promises';

import { CandidateDocument } from '../entities/candidate-document.entity';
import { SampleCandidate } from '../entities/sample-candidate.entity';
import { DocumentsService } from './documents.service';

jest.mock('fs/promises');

describe('DocumentsService', () => {
  let service: DocumentsService;

  const documentsRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const candidatesRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: getRepositoryToken(CandidateDocument),
          useValue: documentsRepository,
        },
        {
          provide: getRepositoryToken(SampleCandidate),
          useValue: candidatesRepository,
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  it('throws NotFoundException if candidate is missing or unauthorized', async () => {
    candidatesRepository.findOne.mockResolvedValue(null);

    await expect(
      service.createDocument(
        { userId: 'u1', workspaceId: 'w1' },
        'c1',
        { documentType: 'resume', fileName: 'test.pdf', rawText: 'text' },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('creates document successfully', async () => {
    candidatesRepository.findOne.mockResolvedValue({ id: 'c1', workspaceId: 'w1' });
    
    // Mock fs
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

    documentsRepository.create.mockImplementation((val) => val);
    documentsRepository.save.mockImplementation(async (val) => val);

    const result = await service.createDocument(
      { userId: 'u1', workspaceId: 'w1' },
      'c1',
      { documentType: 'resume', fileName: 'test.pdf', rawText: 'my text content' },
    );

    expect(fs.mkdir).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('.txt'), // Checks the extension
      'my text content',
      'utf8',
    );
    expect(documentsRepository.save).toHaveBeenCalled();
    expect(result.candidateId).toBe('c1');
    expect(result.documentType).toBe('resume');
  });

  describe('findAllWorkspaceDocuments', () => {
    it('returns documents for the workspace', async () => {
      const mockDocs = [{ id: 'doc1', candidateId: 'c1' }];
      documentsRepository.find.mockResolvedValue(mockDocs);

      const result = await service.findAllWorkspaceDocuments({ userId: 'u1', workspaceId: 'w1' });

      expect(documentsRepository.find).toHaveBeenCalledWith({
        relations: ['candidate'],
        where: {
          candidate: { workspaceId: 'w1' },
        },
        order: { uploadedAt: 'DESC' },
      });
      expect(result).toEqual(mockDocs);
    });
  });
});

