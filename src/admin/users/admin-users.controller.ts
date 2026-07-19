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
import { AdminCreateUserDto, AdminUpdateUserDto } from './admin-users.dto';
import { AdminUsersService } from './admin-users.service';

@Controller('api/v1/admin/users')
@UseGuards(AdminJwtGuard)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.users.list({
      q,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Post()
  create(@Body() body: AdminCreateUserDto) {
    return this.users.create(body);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.users.detail(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: AdminUpdateUserDto) {
    return this.users.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.users.remove(id);
  }
}
