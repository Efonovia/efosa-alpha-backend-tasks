import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuthUser } from '../auth/auth.types';
import { CandidateDocument } from '../entities/candidate-document.entity';
import { SampleCandidate } from '../entities/sample-candidate.entity';
import { CreateDocumentDto } from './dto/create-document.dto';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(CandidateDocument)
    private readonly documentsRepository: Repository<CandidateDocument>,
    @InjectRepository(SampleCandidate)
    private readonly candidatesRepository: Repository<SampleCandidate>,
  ) {}

  async createDocument(
    user: AuthUser,
    candidateId: string,
    dto: CreateDocumentDto,
  ): Promise<CandidateDocument> {
    // 1. Verify candidate belongs to the workspace
    const candidate = await this.candidatesRepository.findOne({
      where: { id: candidateId, workspaceId: user.workspaceId },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found or access denied');
    }

    // 2. File storage (local FS abstraction)
    const storageKey = `docs/${user.workspaceId}/${candidateId}/${randomUUID()}.txt`;
    const fullPath = path.join(UPLOADS_DIR, storageKey);

    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      // Write the content
      await fs.writeFile(fullPath, dto.rawText, 'utf8');
    } catch (err) {
      throw new InternalServerErrorException('Failed to store document file');
    }

    // 3. Save to database
    const document = this.documentsRepository.create({
      id: randomUUID(),
      candidateId,
      documentType: dto.documentType,
      fileName: dto.fileName,
      storageKey,
      rawText: dto.rawText,
    });

    return this.documentsRepository.save(document);
  }
}
