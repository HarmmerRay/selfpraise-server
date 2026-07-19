import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ShutdownService } from './common/health/shutdown.service';

const APP_VERSION = process.env.APP_VERSION || 'v1.0.0';
const logger = new Logger('Bootstrap');

// BIGINT 雪花 ID 对外 JSON 一律序列化为 string
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

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

  app.use('/api/v1/version', (_req: any, res: any) => {
    res.status(200).json({ version: APP_VERSION });
  });

  app.enableShutdownHooks();

  await app.listen(process.env.PORT || 3000);
  logger.log(
    `API Server running on http://localhost:${process.env.PORT || 3000} version=${APP_VERSION}`,
  );

  const shutdown = app.get(ShutdownService);
  process.on('SIGTERM', () => {
    logger.log('收到 SIGTERM，开始优雅关机...');
    shutdown.markShuttingDown();
  });
}

bootstrap();
