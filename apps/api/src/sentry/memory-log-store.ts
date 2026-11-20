import type {
  LogQueryLine,
  LogQueryRequest,
  LogQueryResponse,
} from '@code-sentry/node';

const DEFAULT_CAPACITY = 2000;

export type StoredLogLine = LogQueryLine;

/**
 * In-memory ring buffer for demo on-demand log query.
 * Not durable — enough for Code Sentry Agent 回查验收.
 */
export class MemoryLogStore {
  private readonly lines: StoredLogLine[] = [];
  private readonly capacity: number;

  constructor(capacity = DEFAULT_CAPACITY) {
    this.capacity = capacity;
  }

  append(
    level: string,
    message: string,
    fields?: Record<string, unknown>,
  ): void {
    this.lines.push({
      timestamp: new Date().toISOString(),
      level: level.toLowerCase(),
      message,
      ...(fields ? { fields } : {}),
    });
    if (this.lines.length > this.capacity) {
      this.lines.splice(0, this.lines.length - this.capacity);
    }
  }

  query(request: LogQueryRequest): LogQueryResponse {
    const fromMs = Date.parse(request.from);
    const toMs = Date.parse(request.to);
    const limit = Math.min(
      Math.max(request.limit ?? 200, 1),
      this.capacity,
    );
    const levels = request.levels?.map((l) => l.toLowerCase());
    const keywords = request.keywords?.trim().toLowerCase();
    const traceId = request.traceId?.trim();
    const requestId = request.requestId?.trim();

    const matched: LogQueryLine[] = [];
    for (const line of this.lines) {
      const ts = Date.parse(line.timestamp);
      if (Number.isFinite(fromMs) && ts < fromMs) continue;
      if (Number.isFinite(toMs) && ts > toMs) continue;
      if (levels?.length && !levels.includes(line.level.toLowerCase())) {
        continue;
      }
      if (keywords && !line.message.toLowerCase().includes(keywords)) {
        continue;
      }
      if (traceId) {
        const field = line.fields?.traceId ?? line.fields?.trace_id;
        if (field !== traceId) continue;
      }
      if (requestId) {
        const field = line.fields?.requestId ?? line.fields?.request_id;
        if (field !== requestId) continue;
      }
      matched.push(line);
      if (matched.length > limit) break;
    }

    const truncated = matched.length > limit;
    return {
      lines: truncated ? matched.slice(0, limit) : matched,
      truncated,
    };
  }
}

/** Process-wide store so Nest Logger + SentryService share one buffer. */
export const appLogStore = new MemoryLogStore();
