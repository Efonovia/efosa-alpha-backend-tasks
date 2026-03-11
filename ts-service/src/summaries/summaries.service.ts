import { randomUUID } from 'crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuthUser } from '../auth/auth.types';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { SampleCandidate } from '../entities/sample-candidate.entity';
import { QueueService } from '../queue/queue.service';

export interface GenerateSummaryJobPayload {
  candidateId: string;
  summaryId: string;
}

@Injectable()
export class SummariesService {
  constructor(
    @InjectRepository(CandidateSummary)
    private readonly summariesRepository: Repository<CandidateSummary>,
    @InjectRepository(SampleCandidate)
    private readonly candidatesRepository: Repository<SampleCandidate>,
    private readonly queueService: QueueService,
  ) {}

  async requestSummaryGeneration(
    user: AuthUser,
    candidateId: string,
  ): Promise<{ message: string; summaryId: string }> {
    // 1. Validate candidate belongs to workspace
    const candidate = await this.candidatesRepository.findOne({
      where: { id: candidateId, workspaceId: user.workspaceId },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found or access denied');
    }

    // 2. Create pending summary record
    const summary = this.summariesRepository.create({
      id: randomUUID(),
      candidateId,
      status: 'pending',
    });
    await this.summariesRepository.save(summary);

    // 3. Enqueue background processing
    this.queueService.enqueue<GenerateSummaryJobPayload>('generate_summary', {
      candidateId,
      summaryId: summary.id,
    });

    return {
      message: 'Summary generation enqueued successfully',
      summaryId: summary.id,
    };
  }

  async getSummaries(user: AuthUser, candidateId: string): Promise<CandidateSummary[]> {
    const candidate = await this.candidatesRepository.findOne({
      where: { id: candidateId, workspaceId: user.workspaceId },
    });
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    return this.summariesRepository.find({
      where: { candidateId },
      order: { createdAt: 'DESC' },
    });
  }

  async getSummary(user: AuthUser, candidateId: string, summaryId: string): Promise<CandidateSummary> {
    const candidate = await this.candidatesRepository.findOne({
      where: { id: candidateId, workspaceId: user.workspaceId },
    });
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    const summary = await this.summariesRepository.findOne({
      where: { id: summaryId, candidateId },
    });
    if (!summary) {
      throw new NotFoundException('Summary not found');
    }

    return summary;
  }
}
