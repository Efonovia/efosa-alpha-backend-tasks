import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/auth-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { FakeAuthGuard } from '../auth/fake-auth.guard';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@Controller()
@UseGuards(FakeAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('candidates/:candidateId/documents')
  async createDocument(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
    @Body() dto: CreateDocumentDto,
  ) {
    const document = await this.documentsService.createDocument(
      user,
      candidateId,
      dto,
    );
    return document;
  }

  @Get('documents')
  async getWorkspaceDocuments(@CurrentUser() user: AuthUser) {
    return this.documentsService.findAllWorkspaceDocuments(user);
  }
}
