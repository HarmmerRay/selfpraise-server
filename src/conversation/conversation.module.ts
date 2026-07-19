import { Module } from '@nestjs/common';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { AgnesLlmService } from './agnes-llm.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [PrismaModule, AuthModule, MemoryModule],
  controllers: [ConversationController],
  providers: [ConversationService, AgnesLlmService],
})
export class ConversationModule {}
