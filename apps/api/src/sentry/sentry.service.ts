import {
  captureException,
  captureMessage,
  init,
  ping,
  registerLogQuery,
  resetClient,
  type RegisterLogQueryHandle,
} from '@code-sentry/node';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';
import { appLogStore } from './memory-log-store';

@Injectable()
export class SentryService implements OnModuleDestroy {
  private readonly logger = new Logger(SentryService.name);
  private ready = false;
  private logQueryHandle: RegisterLogQueryHandle | undefined;

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
      await this.registerLogQueryFromConfig(cs);
    } catch (err) {
      this.ready = false;
      resetClient();
      this.logger.error(
        `Code Sentry ping failed → ${cs.baseUrl}; reporting disabled`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  private async registerLogQueryFromConfig(
    cs: AppConfig['codeSentry'],
  ): Promise<void> {
    if (!cs.publicBaseUrl) {
      this.logger.warn(
        'CODE_SENTRY_PUBLIC_BASE_URL unset; skip log-query registration',
      );
      return;
    }
    try {
      this.logQueryHandle = await registerLogQuery({
        service: cs.service,
        publicBaseUrl: cs.publicBaseUrl,
        listenPort: cs.logQueryPort,
        query: (request) => appLogStore.query(request),
        meta: { app: 'code-test-api' },
      });
      this.logger.log(
        `Code Sentry log-query registered → ${this.logQueryHandle.callbackUrl} (listen :${this.logQueryHandle.port})`,
      );
      appLogStore.append('info', 'log-query registered with Code Sentry', {
        callbackUrl: this.logQueryHandle.callbackUrl,
      });
    } catch (err) {
      this.logger.error(
        `Code Sentry log-query register failed → ${cs.publicBaseUrl}`,
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

  async onModuleDestroy(): Promise<void> {
    if (this.logQueryHandle) {
      await this.logQueryHandle.stop();
      this.logQueryHandle = undefined;
    }
  }
}
