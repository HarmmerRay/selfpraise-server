import { Module } from '@nestjs/common';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { AgnesLlmService } from './agnes-llm.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ConversationController],
  providers: [ConversationService, AgnesLlmService],
})
export class ConversationModule {}
