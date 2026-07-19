import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { HttpMetricsService } from './http-metrics.service';

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: HttpMetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const path = req.path || req.url || '/';
    // 采集端点自身不计，避免 scrape 自增污染
    if (path === '/metrics' || path.startsWith('/metrics?')) {
      next();
      return;
    }

    res.on('finish', () => {
      try {
        this.metrics.observe(req.method, path, res.statusCode);
      } catch {
        /* 指标失败不影响业务 */
      }
    });
    next();
  }
}
