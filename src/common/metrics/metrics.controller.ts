import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HttpMetricsService } from './http-metrics.service';

/** Prometheus scrape 入口（无鉴权；生产应由内网 / Nginx 限制访问） */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: HttpMetricsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async scrape(@Res() res: Response) {
    res.setHeader('Content-Type', this.metrics.contentType());
    res.send(await this.metrics.metricsText());
  }
}
