import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { LongTermMemoryService } from './long-term-memory.service';
import { MemoryOrchestratorService } from './memory-orchestrator.service';
import { MemoryRetrievalService } from './memory-retrieval.service';
import { LlmUsageService } from './llm-usage.service';

@Controller('api/v1/memory')
@UseGuards(JwtAuthGuard)
export class MemoryController {
  constructor(
    private readonly ltm: LongTermMemoryService,
    private readonly orchestrator: MemoryOrchestratorService,
    private readonly retrieval: MemoryRetrievalService,
    private readonly usage: LlmUsageService,
  ) {}

  @Get('chunks')
  listChunks(@CurrentUserId() userId: string) {
    return this.ltm.listChunks(userId);
  }

  @Post('chunks')
  createChunk(
    @CurrentUserId() userId: string,
    @Body()
    body: {
      memoryType: string;
      content: string;
      importance?: number;
      sourceRef?: string;
    },
  ) {
    return this.ltm.saveFacet(
      userId,
      body.memoryType,
      body.content,
      body.importance ?? 0.6,
      body.sourceRef,
    );
  }

  @Delete('chunks/:id')
  async deleteChunk(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    const deleted = await this.ltm.deleteChunk(userId, id);
    return { ok: !!deleted };
  }

  @Get('profile')
  getProfile(@CurrentUserId() userId: string) {
    return this.ltm.getCachedOrBuildProfile(userId);
  }

  @Get('context/:sessionId')
  previewContext(
    @CurrentUserId() userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.orchestrator.buildChatContext(userId, sessionId);
  }

  @Post('retrieve')
  retrieve(
    @CurrentUserId() userId: string,
    @Body() body: { query: string; topK?: number },
  ) {
    return this.retrieval.retrieve(userId, body.query ?? '', body.topK ?? 5);
  }

  @Post('extract')
  extract(
    @CurrentUserId() userId: string,
    @Body() body: { sessionId: string },
  ) {
    return this.orchestrator.enqueueExtract(userId, body.sessionId);
  }

  @Get('metrics/tokens')
  tokenMetrics(
    @CurrentUserId() userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.usage.aggregateForUser(
      userId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }
}
