import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { MemoService } from './memo.service';
import { CreateMemoDto, MemoResponseDto } from './memo.dto';

@Controller('api/input/memo')
export class MemoController {
  constructor(private readonly memoService: MemoService) {}

  @Post()
  async create(@Body() dto: CreateMemoDto): Promise<MemoResponseDto> {
    return this.memoService.create(dto);
  }

  @Get()
  async findAll(): Promise<MemoResponseDto[]> {
    return this.memoService.findAll();
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ deleted: boolean }> {
    return this.memoService.remove(id);
  }
}
