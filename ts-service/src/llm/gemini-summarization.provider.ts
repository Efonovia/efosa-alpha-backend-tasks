import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GoogleGenAI, Type, Schema } from '@google/genai';

import {
  CandidateSummaryInput,
  CandidateSummaryResult,
  SummarizationProvider,
} from './summarization-provider.interface';

@Injectable()
export class GeminiSummarizationProvider implements SummarizationProvider {
  private readonly logger = new Logger(GeminiSummarizationProvider.name);
  private ai: GoogleGenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('Initialised Gemini provider without API key!');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateCandidateSummary(
    input: CandidateSummaryInput,
  ): Promise<CandidateSummaryResult> {
    const { candidateId, documents } = input;
    
    // Concatenate all text from all documents
    const combinedDocuments = documents
      .map((docText, index) => `=== Document ${index + 1} ===\n${docText}\n\n`)
      .join('');

    const systemInstruction = `You are an expert technical recruiter and engineered system. 
Analyze the provided candidate documents and output a structured JSON summary.
Evaluate strengths, concerns, and give an overall score out of 100.
Also, give a recommended decision from 'advance', 'hold', or 'reject'.`;

    const prompt = `Candidate ID: ${candidateId}
Candidate Documents:
${combinedDocuments}`;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        score: {
          type: Type.INTEGER,
          description: "A score from 0 to 100 representing the candidate's fitness.",
        },
        strengths: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
          description: "A list of strings outlining the candidate's strengths.",
        },
        concerns: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
          description: "A list of strings outlining concerns or areas for improvement.",
        },
        summary: {
          type: Type.STRING,
          description: "A professional summary of the candidate.",
        },
        recommendedDecision: {
          type: Type.STRING,
          enum: ["advance", "hold", "reject"],
          description: "The recommended decision.",
        },
      },
      required: ["score", "strengths", "concerns", "summary", "recommendedDecision"],
    };

    try {
      this.logger.log(`Calling Gemini API for candidate ${candidateId}...`);
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error('Gemini API returned an empty response.');
      }

      const parsed: CandidateSummaryResult = JSON.parse(text);
      return parsed;
    } catch (error) {
      this.logger.error(`Failed to generate summary with Gemini: ${(error as any).message}`);
      throw error;
    }
  }
}
