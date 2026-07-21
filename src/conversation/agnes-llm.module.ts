import { Module } from '@nestjs/common';
import { AgnesLlmService } from './agnes-llm.service';

@Module({
  providers: [AgnesLlmService],
  exports: [AgnesLlmService],
})
export class AgnesLlmModule {}
