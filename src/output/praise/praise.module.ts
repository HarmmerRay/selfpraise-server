import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PraiseController } from './praise.controller';
import { PraiseService } from './praise.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule, BullModule.registerQueue({ name: 'praise' })],
  controllers: [PraiseController],
  providers: [PraiseService],
  exports: [PraiseService],
})
export class PraiseModule {}
