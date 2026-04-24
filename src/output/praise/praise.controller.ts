import { Controller, Get, Post, Param } from '@nestjs/common';
import { PraiseService } from './praise.service';
import { PraiseResponseDto } from './praise.dto';

@Controller('api/output/praise')
export class PraiseController {
  constructor(private readonly praiseService: PraiseService) {}

  @Post('generate')
  async generate(): Promise<{ jobId: string }> {
    return this.praiseService.requestGeneration();
  }

  @Get()
  async findAll(): Promise<PraiseResponseDto[]> {
    return this.praiseService.findAll();
  }

  @Get(':id/audio')
  async getAudio(@Param('id') id: string): Promise<{ audioPath: string }> {
    return this.praiseService.getAudioPath(id);
  }
}
