import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { HttpMetricsService } from './http-metrics.service';
import { HttpMetricsMiddleware } from './http-metrics.middleware';
import { MetricsController } from './metrics.controller';

@Module({
  controllers: [MetricsController],
  providers: [HttpMetricsService],
  exports: [HttpMetricsService],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(HttpMetricsMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
