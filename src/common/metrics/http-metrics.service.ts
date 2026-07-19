import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Counter,
  Registry,
  collectDefaultMetrics,
  register as defaultRegister,
} from 'prom-client';
import { normalizeRoute } from './route-normalize';

/**
 * 进程内 Prometheus 指标（不访问 Redis/PG，监控旁路不影响业务 IO）。
 */
@Injectable()
export class HttpMetricsService implements OnModuleInit {
  readonly registry: Registry = defaultRegister;
  private requests!: Counter<string>;

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry });
    // 热重载时避免重复注册
    const existing = this.registry.getSingleMetric('http_requests_total');
    if (existing) {
      this.requests = existing as Counter<string>;
      return;
    }
    this.requests = new Counter({
      name: 'http_requests_total',
      help: 'HTTP 请求总数',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });
  }

  observe(method: string, path: string, statusCode: number) {
    const route = normalizeRoute(method, path).replace(/^[^:]+:/, '') || path;
    const m = (method || 'GET').toUpperCase();
    this.requests.inc({
      method: m,
      route,
      status_code: String(statusCode || 0),
    });
  }

  async metricsText(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}
