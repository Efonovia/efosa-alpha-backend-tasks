import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/auth-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { FakeAuthGuard } from '../auth/fake-auth.guard';
import { SummariesService } from './summaries.service';

@Controller('candidate/:candidateId/summaries')
@UseGuards(FakeAuthGuard)
export class SummariesController {
  constructor(private readonly summariesService: SummariesService) {}

  @Post('generate')
  async generateSummary(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
  ) {
    return this.summariesService.requestSummaryGeneration(user, candidateId);
  }

  @Get()
  async getSummaries(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
  ) {
    return this.summariesService.getSummaries(user, candidateId);
  }

  @Get(':summaryId')
  async getSummary(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
    @Param('summaryId') summaryId: string,
  ) {
    return this.summariesService.getSummary(user, candidateId, summaryId);
  }
}
