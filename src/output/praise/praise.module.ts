import { Module } from '@nestjs/common';
import { PraiseController } from './praise.controller';
import { PraiseService } from './praise.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PraiseController],
  providers: [PraiseService],
  exports: [PraiseService],
})
export class PraiseModule {}
