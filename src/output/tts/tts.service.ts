import { Injectable } from '@nestjs/common';

export interface TtsResult {
  audioPath: string;
  duration: number;
}

@Injectable()
export class TtsService {
  async synthesize(text: string, userId: string): Promise<TtsResult> {
    // TODO: 调用阿里云 TTS API 合成语音
    // 1. 调用阿里云语音合成接口
    // 2. 将返回的音频保存到本地文件或对象存储
    // 3. 返回音频文件路径

    const audioPath = `audio/${userId}/${Date.now()}.mp3`;

    return {
      audioPath,
      duration: 0,
    };
  }
}
