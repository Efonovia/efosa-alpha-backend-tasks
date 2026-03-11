import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { FakeSummarizationProvider } from './fake-summarization.provider';
import { GeminiSummarizationProvider } from './gemini-summarization.provider';
import { SUMMARIZATION_PROVIDER } from './summarization-provider.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    FakeSummarizationProvider,
    GeminiSummarizationProvider,
    {
      provide: SUMMARIZATION_PROVIDER,
      inject: [ConfigService, FakeSummarizationProvider, GeminiSummarizationProvider],
      useFactory: (
        configService: ConfigService,
        fakeProvider: FakeSummarizationProvider,
        geminiProvider: GeminiSummarizationProvider,
      ) => {
        const apiKey = configService.get<string>('GEMINI_API_KEY');
        return apiKey ? geminiProvider : fakeProvider;
      },
    },
  ],
  exports: [SUMMARIZATION_PROVIDER],
})
export class LlmModule {}
