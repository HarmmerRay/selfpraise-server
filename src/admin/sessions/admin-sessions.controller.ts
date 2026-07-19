import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import {
  AdminCreateSessionDto,
  AdminUpdateSessionDto,
} from './admin-sessions.dto';
import { AdminSessionsService } from './admin-sessions.service';

@Controller('api/v1/admin/sessions')
@UseGuards(AdminJwtGuard)
export class AdminSessionsController {
  constructor(private readonly sessions: AdminSessionsService) {}

  @Get()
  list(
    @Query('userId') userId?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.sessions.list({
      userId,
      q,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Post()
  create(@Body() body: AdminCreateSessionDto) {
    return this.sessions.create(body);
  }

  @Get(':id/messages')
  messages(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.sessions.messages(
      id,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: AdminUpdateSessionDto) {
    return this.sessions.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sessions.remove(id);
  }
}
