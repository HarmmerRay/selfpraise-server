import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PraiseController } from './praise.controller';
import { PraiseService } from './praise.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, BullModule.registerQueue({ name: 'praise' })],
  controllers: [PraiseController],
  providers: [PraiseService],
  exports: [PraiseService],
})
export class PraiseModule {}
