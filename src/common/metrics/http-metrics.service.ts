import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Counter,
  Histogram,
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
  private llmDuration!: Histogram<string>;

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry });
    // 热重载时避免重复注册
    const existing = this.registry.getSingleMetric('http_requests_total');
    if (existing) {
      this.requests = existing as Counter<string>;
    } else {
      this.requests = new Counter({
        name: 'http_requests_total',
        help: 'HTTP 请求总数',
        labelNames: ['method', 'route', 'status_code'],
        registers: [this.registry],
      });
    }

    const existingLlm = this.registry.getSingleMetric(
      'llm_request_duration_seconds',
    );
    if (existingLlm) {
      this.llmDuration = existingLlm as Histogram<string>;
    } else {
      this.llmDuration = new Histogram({
        name: 'llm_request_duration_seconds',
        help: 'LLM API 调用耗时（秒）',
        labelNames: ['operation', 'status', 'phase'],
        buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60],
        registers: [this.registry],
      });
    }
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

  /** operation: stream|complete；phase: ttft|total；status: ok|error|fake */
  observeLlm(
    operation: string,
    status: string,
    phase: string,
    seconds: number,
  ) {
    if (!this.llmDuration) return;
    this.llmDuration.observe(
      { operation, status, phase },
      Math.max(0, seconds),
    );
  }

  async metricsText(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}
