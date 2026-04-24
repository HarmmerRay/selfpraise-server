import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WorkersModule } from './workers/workers.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  // 手动初始化 WorkersModule，激活所有 Worker
  app.select(WorkersModule);

  console.log('[Worker Server] running, listening for jobs...');

  // 保持进程运行
  await new Promise(() => {});
}

bootstrap();
