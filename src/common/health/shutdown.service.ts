import { Injectable } from '@nestjs/common';

@Injectable()
export class ShutdownService {
  private shuttingDown = false;

  markShuttingDown(): void {
    this.shuttingDown = true;
  }

  get isShuttingDown(): boolean {
    return this.shuttingDown;
  }
}
