import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { EpisodeService } from './episode.service';
import { CreateEpisodeDto, EpisodeResponseDto } from './episode.dto';

/** 用户在世界上发生的、值得记录的事件 */
@Controller('api/v1/episodes')
export class EpisodeController {
  constructor(private readonly episodeService: EpisodeService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Body() dto: CreateEpisodeDto,
  ): Promise<EpisodeResponseDto> {
    return this.episodeService.create(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@CurrentUserId() userId: string): Promise<EpisodeResponseDto[]> {
    return this.episodeService.list(userId);
  }
}
