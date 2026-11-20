import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import { appLogStore } from './memory-log-store';

/** Nest logger that mirrors lines into MemoryLogStore for Agent 回查. */
export class BufferedLogger extends ConsoleLogger {
  protected override printMessages(
    messages: unknown[],
    context?: string,
    logLevel?: LogLevel,
    writeStreamType?: 'stdout' | 'stderr',
    errorStack?: unknown,
  ): void {
    super.printMessages(messages, context, logLevel, writeStreamType, errorStack);
    const level = (logLevel ?? 'log').toString();
    const text = messages
      .map((m) => (typeof m === 'string' ? m : JSON.stringify(m)))
      .join(' ');
    const message = context ? `[${context}] ${text}` : text;
    appLogStore.append(level, message, context ? { context } : undefined);
  }
}
