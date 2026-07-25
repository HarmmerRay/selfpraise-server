import { Module } from '@nestjs/common';
import { AgnesLlmService } from './agnes-llm.service';
import { MetricsModule } from '../common/metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  providers: [AgnesLlmService],
  exports: [AgnesLlmService],
})
export class AgnesLlmModule {}
