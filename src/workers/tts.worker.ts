import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';

@Processor('tts')
export class TtsWorker {
  constructor(private readonly prisma: PrismaService) {}

  @Process('synthesize')
  async handleSynthesis(job: Job<{ praiseId: string; userId: string }>): Promise<void> {
    const { praiseId, userId } = job.data;

    const praise = await this.prisma.praise.findUnique({
      where: { id: praiseId },
    });

    if (!praise || !praise.content) {
      console.log(`夸赞 ${praiseId} 不存在或无内容，跳过 TTS`);
      return;
    }

    // TODO: 调用阿里云 TTS API 合成语音
    console.log(`[DEV] TTS 合成中，夸赞ID: ${praiseId}, 内容: ${praise.content}`);

    const audioPath = `audio/${userId}/${Date.now()}.mp3`;

    await this.prisma.praise.update({
      where: { id: praiseId },
      data: {
        audioPath,
        status: 'synthesized',
      },
    });

    console.log(`TTS 合成完成，夸赞ID: ${praiseId}, 音频路径: ${audioPath}`);
  }
}
