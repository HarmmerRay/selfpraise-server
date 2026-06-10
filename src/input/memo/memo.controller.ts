import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { MemoService } from './memo.service';
import { CreateMemoDto, MemoResponseDto } from './memo.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';

/** 遗留 MVP：备忘录录入（JWT 必选） */
@Controller('api/input/memo')
export class MemoController {
  constructor(private readonly memoService: MemoService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Body() dto: CreateMemoDto,
  ): Promise<MemoResponseDto> {
    return this.memoService.create(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@CurrentUserId() userId: string): Promise<MemoResponseDto[]> {
    return this.memoService.findAll(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ): Promise<{ deleted: boolean }> {
    return this.memoService.remove(userId, id);
  }
}
