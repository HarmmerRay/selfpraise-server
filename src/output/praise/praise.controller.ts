import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { PraiseService } from './praise.service';
import { PraiseResponseDto } from './praise.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';

@Controller('api/output/praise')
export class PraiseController {
  constructor(private readonly praiseService: PraiseService) {}

  @UseGuards(JwtAuthGuard)
  @Post('generate')
  async generate(@CurrentUserId() userId: string): Promise<{ jobId: string }> {
    return this.praiseService.requestGeneration(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@CurrentUserId() userId: string): Promise<PraiseResponseDto[]> {
    return this.praiseService.findAll(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/audio')
  async getAudio(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ): Promise<{ audioPath: string }> {
    return this.praiseService.getAudioPath(userId, id);
  }
}
