import { Injectable } from '@nestjs/common';

export interface TtsResult {
  audioPath: string;
  duration: number;
}

@Injectable()
export class TtsService {
  synthesize(text: string, userId: string): Promise<TtsResult> {
    void text;
    const audioPath = `audio/${userId}/${Date.now()}.mp3`;

    return Promise.resolve({
      audioPath,
      duration: 0,
    });
  }
}
