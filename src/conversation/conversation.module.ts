import { Module } from '@nestjs/common';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { AgnesLlmModule } from './agnes-llm.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [PrismaModule, AuthModule, MemoryModule, AgnesLlmModule],
  controllers: [ConversationController],
  providers: [ConversationService],
})
export class ConversationModule {}
