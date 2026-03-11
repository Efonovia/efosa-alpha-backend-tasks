import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { SUMMARIZATION_PROVIDER, SummarizationProvider } from '../llm/summarization-provider.interface';
import { QueueService } from '../queue/queue.service';
import { GenerateSummaryJobPayload } from './summaries.service';

@Injectable()
export class WorkerService implements OnModuleInit {
  private readonly logger = new Logger(WorkerService.name);
  private pollingInterval: NodeJS.Timeout | null = null;
  private processedJobIds = new Set<string>();

  constructor(
    private readonly queueService: QueueService,
    @InjectRepository(CandidateSummary)
    private readonly summariesRepository: Repository<CandidateSummary>,
    @InjectRepository(CandidateDocument)
    private readonly documentsRepository: Repository<CandidateDocument>,
    @Inject(SUMMARIZATION_PROVIDER)
    private readonly summarizationProvider: SummarizationProvider,
  ) {}

  onModuleInit() {
    // Start polling the queue service since it doesn't emit events
    this.pollingInterval = setInterval(() => {
      this.pollQueue();
    }, 5000); // Check every 5 seconds
    this.logger.log('Started background worker polling for summary jobs.');
  }

  private async pollQueue() {
    const allJobs = this.queueService.getQueuedJobs();
    
    // Find unhandled valid jobs securely
    for (const job of allJobs) {
      if (job.name === 'generate_summary' && !this.processedJobIds.has(job.id)) {
        this.processedJobIds.add(job.id); // Mark as picked up
        this.processSummaryJob(job.payload as GenerateSummaryJobPayload).catch(err => {
          this.logger.error(`Failed executing job ${job.id}: ${err.message}`);
        });
      }
    }
  }

  private async processSummaryJob(payload: GenerateSummaryJobPayload) {
    this.logger.log(`Processing summary generation for candidate ${payload.candidateId}, summary ${payload.summaryId}`);
    
    // Get the pending summary to ensure it exists and get prompt info
    const summary = await this.summariesRepository.findOne({ where: { id: payload.summaryId } });
    if (!summary || summary.status !== 'pending') {
      this.logger.warn(`Summary ${payload.summaryId} not found or not pending. Bailing out.`);
      return;
    }

    try {
      // Fetch all candidate documents
      const documents = await this.documentsRepository.find({
        where: { candidateId: payload.candidateId },
      });

      // read `rawText` directly from database since we store it there as well as locally
      const docContents = documents.map(doc => doc.rawText);

      // Call gemini
      const result = await this.summarizationProvider.generateCandidateSummary({
        candidateId: payload.candidateId,
        documents: docContents,
      });

      // Update the DB record as completed with the structured data
      await this.summariesRepository.update(payload.summaryId, {
        status: 'completed',
        score: result.score,
        strengths: result.strengths,
        concerns: result.concerns,
        summary: result.summary,
        recommendedDecision: result.recommendedDecision,
        provider: this.summarizationProvider.constructor.name,
      });
      this.logger.log(`Summary ${payload.summaryId} completed successfully.`);

    } catch (error) {
      this.logger.error(`Error processing summary ${payload.summaryId}: ${(error as any).message}`);
      // Mark as failed
      await this.summariesRepository.update(payload.summaryId, {
        status: 'failed',
        errorMessage: (error as any).message || 'Unknown processing error',
      });
    }
  }
}
