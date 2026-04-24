import { Module } from '@nestjs/common';
import { PraiseWorker } from './praise.worker';
import { TtsWorker } from './tts.worker';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [PraiseWorker, TtsWorker],
})
export class WorkersModule {}
