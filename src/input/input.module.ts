import { Module } from '@nestjs/common';
import { MemoModule } from './memo/memo.module';

@Module({
  imports: [MemoModule],
  exports: [MemoModule],
})
export class InputModule {}
