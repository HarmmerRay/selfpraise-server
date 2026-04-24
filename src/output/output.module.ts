import { Module } from '@nestjs/common';
import { PraiseModule } from './praise/praise.module';
import { TtsModule } from './tts/tts.module';

@Module({
  imports: [PraiseModule, TtsModule],
  exports: [PraiseModule, TtsModule],
})
export class OutputModule {}
