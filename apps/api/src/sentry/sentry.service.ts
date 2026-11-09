import {
  captureException,
  captureMessage,
  init,
  ping,
  resetClient,
} from '@code-sentry/node';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';

@Injectable()
export class SentryService {
  private readonly logger = new Logger(SentryService.name);
  private ready = false;

  constructor(private readonly config: ConfigService) {}

  async initFromConfig(): Promise<void> {
    const cs = this.config.get<AppConfig['codeSentry']>('codeSentry');
    if (!cs?.baseUrl || !cs.webhookToken) {
      this.logger.warn(
        'Code Sentry not configured (CODE_SENTRY_BASE_URL / CODE_SENTRY_WEBHOOK_TOKEN); reporting disabled',
      );
      this.ready = false;
      return;
    }
    init({
      baseUrl: cs.baseUrl,
      webhookToken: cs.webhookToken,
      environment: cs.environment,
      service: cs.service,
    });
    try {
      const result = await ping();
      this.ready = true;
      this.logger.log(
        `Code Sentry ping ok → ${cs.baseUrl} project=${result.name}(${result.projectId}) service=${cs.service}`,
      );
    } catch (err) {
      this.ready = false;
      resetClient();
      this.logger.error(
        `Code Sentry ping failed → ${cs.baseUrl}; reporting disabled`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  async reportError(
    error: unknown,
    context?: { request_id?: string; tags?: Record<string, unknown> },
  ): Promise<void> {
    if (!this.ready) {
      return;
    }
    await captureException(error, context);
  }

  async reportMessage(
    message: string,
    context?: { tags?: Record<string, unknown> },
  ): Promise<void> {
    if (!this.ready) {
      return;
    }
    await captureMessage(message, context);
  }

  /** Tests only. */
  reset(): void {
    this.ready = false;
    resetClient();
  }
}
