import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';

@Processor('praise')
export class PraiseWorker {
  constructor(private readonly prisma: PrismaService) {}

  @Process('generate')
  async handleGeneration(job: Job<{ userId: string }>): Promise<void> {
    const { userId } = job.data;

    // 1. 读取用户所有备忘录
    const memos = await this.prisma.memo.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (memos.length === 0) {
      console.log(`用户 ${userId} 暂无备忘录，跳过夸赞生成`);
      return;
    }

    // 2. 组装 Prompt
    const memoTexts = memos
      .map((m) => `- [${m.createdAt.toISOString()}] ${m.title}: ${m.content}`)
      .join('\n');

    const prompt = `以下是用户的备忘录记录：\n${memoTexts}\n\n请根据以上内容，生成一段30字以内的温暖夸赞，语气自然真诚，像朋友之间的鼓励。`;

    // TODO: 调用通义千问 API
    console.log(`[DEV] Prompt 已组装，准备调用通义千问:\n${prompt}`);

    const generatedContent = `[开发阶段] 夸赞内容占位`;

    // 3. 存储夸赞记录
    await this.prisma.praise.create({
      data: {
        userId,
        content: generatedContent,
        status: 'generated',
      },
    });

    console.log(`夸赞已生成，用户: ${userId}`);
  }
}
