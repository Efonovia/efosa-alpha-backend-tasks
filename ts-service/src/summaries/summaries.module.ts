import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { SampleCandidate } from '../entities/sample-candidate.entity';
import { LlmModule } from '../llm/llm.module';
import { QueueModule } from '../queue/queue.module';
import { SummariesController } from './summaries.controller';
import { SummariesService } from './summaries.service';
import { WorkerService } from './worker.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CandidateSummary, CandidateDocument, SampleCandidate]),
    QueueModule,
    LlmModule,
  ],
  controllers: [SummariesController],
  providers: [SummariesService, WorkerService],
})
export class SummariesModule {}
