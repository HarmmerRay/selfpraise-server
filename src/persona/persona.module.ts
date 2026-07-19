import { Module } from '@nestjs/common';
import { PersonaController } from './persona.controller';
import { PersonaService } from './persona.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [PrismaModule, AuthModule, MemoryModule],
  controllers: [PersonaController],
  providers: [PersonaService],
})
export class PersonaModule {}
