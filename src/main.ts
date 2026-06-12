import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

/** 应用版本号，构建时可注入 */
const APP_VERSION = process.env.APP_VERSION || 'v1.0.0';

const logger = new Logger('Bootstrap');

/**
 * 优雅关机标记。
 * 收到 SIGTERM 后设为 true，/health 立即返回 503，
 * 促使 K8s readinessProbe 失败，Service 停止路由新请求到此 Pod。
 * 已建立的连接（如 SSE 流）会继续完成。
 */
let isShuttingDown = false;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 健康检查端点（不经过 Guards，用于 K8s 探针）
  // 关机期间返回 503，让 K8s 将此 Pod 从 Service 摘除
  app.use('/health', (req: any, res: any) => {
    if (isShuttingDown) {
      res.status(503).json({ status: 'shutting_down', version: APP_VERSION });
      return;
    }
    res.status(200).json({ status: 'ok', version: APP_VERSION });
  });

  // 版本端点（用于验证请求打到哪个版本的 Pod）
  app.use('/api/v1/version', (req: any, res: any) => {
    res.status(200).json({ version: APP_VERSION });
  });

  // 启用 NestJS 优雅关机：收到 SIGTERM 后等待所有请求完成再退出
  app.enableShutdownHooks();

  await app.listen(process.env.PORT || 3000);
  logger.log(
    `API Server running on http://localhost:${process.env.PORT || 3000} version=${APP_VERSION}`,
  );

  // 监听 K8s 发送的终止信号
  process.on('SIGTERM', () => {
    logger.log('收到 SIGTERM，开始优雅关机...');
    isShuttingDown = true;
    // readinessProbe 会开始返回 503
    // K8s 将此 Pod 从 Service Endpoint 列表摘除，新请求不再进来
    // enableShutdownHooks() 会等待所有进行中的请求完成后才退出进程
  });
}

bootstrap();
