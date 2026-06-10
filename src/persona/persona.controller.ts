import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { PersonaService } from './persona.service';
import { PatchPersonaDto, PersonaResponseDto } from './persona.dto';

@Controller('api/v1/persona')
export class PersonaController {
  constructor(private readonly personaService: PersonaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUserId() userId: string): Promise<PersonaResponseDto> {
    return this.personaService.getMine(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async patch(
    @CurrentUserId() userId: string,
    @Body() dto: PatchPersonaDto,
  ): Promise<PersonaResponseDto> {
    return this.personaService.patch(userId, dto);
  }
}
