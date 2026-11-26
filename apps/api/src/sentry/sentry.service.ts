import {
  captureException,
  captureMessage,
  getClient,
  init,
  ping,
  registerDataQuery,
  registerLogQuery,
  resetClient,
  type RegisterDataQueryHandle,
  type RegisterLogQueryHandle,
} from '@code-sentry/node';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import type { AppConfig } from '../config/configuration';
import { appLogStore } from './memory-log-store';

@Injectable()
export class SentryService implements OnModuleDestroy {
  private readonly logger = new Logger(SentryService.name);
  private ready = false;
  private logQueryHandle: RegisterLogQueryHandle | undefined;
  private dataQueryHandle: RegisterDataQueryHandle | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async initFromConfig(): Promise<void> {
    const cs = this.config.get<AppConfig['codeSentry']>('codeSentry');
    if (!cs?.baseUrl || !cs.webhookToken) {
      this.logger.warn(
        'Code Sentry not configured (CODE_SENTRY_BASE_URL / CODE_SENTRY_WEBHOOK_TOKEN); reporting disabled',
      );
      this.ready = false;
      return;
    }
    if (!cs.service?.trim()) {
      this.logger.warn(
        'CODE_SENTRY_SERVICE empty; connectivity heartbeat and Agent log/data query will be unavailable',
      );
    }
    // ≥0.6.0: init({ service }) starts connectivity heartbeat automatically
    init({
      baseUrl: cs.baseUrl,
      webhookToken: cs.webhookToken,
      environment: cs.environment,
      service: cs.service,
      connectivityHeartbeatIntervalMs: cs.connectivityHeartbeatIntervalMs,
    });
    try {
      const result = await ping();
      this.ready = true;
      this.logger.log(
        `Code Sentry ping ok → ${cs.baseUrl} project=${result.name}(${result.projectId}) service=${cs.service}`,
      );
      if (cs.service && cs.connectivityHeartbeatIntervalMs > 0) {
        this.logger.log(
          `Code Sentry connectivity heartbeat on (every ${cs.connectivityHeartbeatIntervalMs}ms) service=${cs.service}`,
        );
      } else {
        this.logger.warn(
          'Code Sentry connectivity heartbeat off (set CODE_SENTRY_SERVICE and interval > 0)',
        );
      }
      await this.registerLogQueryFromConfig(cs);
      await this.registerDataQueryFromConfig(cs);
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
      // service must match init.service so「服务能力」shows 日志可用
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

  private async registerDataQueryFromConfig(
    cs: AppConfig['codeSentry'],
  ): Promise<void> {
    if (!cs.dataPublicBaseUrl) {
      this.logger.warn(
        'CODE_SENTRY_DATA_PUBLIC_BASE_URL unset; skip data-query registration',
      );
      return;
    }
    // Dynamic import avoids OrderService ↔ SentryService circular static deps.
    const { OrderService } = await import('../order/order.service');
    let orders: InstanceType<typeof OrderService>;
    try {
      orders = this.moduleRef.get(OrderService, { strict: false });
    } catch {
      this.logger.warn(
        'OrderService unavailable; skip data-query registration',
      );
      return;
    }
    try {
      this.dataQueryHandle = await registerDataQuery({
        service: cs.service,
        publicBaseUrl: cs.dataPublicBaseUrl,
        listenPort: cs.dataQueryPort,
        meta: { app: 'code-test-api' },
        queries: [
          {
            name: 'order_by_id',
            description: '按订单号查订单摘要',
            params: ['orderId'],
            handler: ({ params }) => {
              const orderId = String(params.orderId ?? '');
              const order = orders.getById(orderId);
              return {
                query: 'order_by_id',
                rows: order ? [{ ...order }] : [],
                truncated: false,
              };
            },
          },
          {
            name: 'orders_recent',
            description: '最近订单列表（只读，无 chaos）',
            params: [],
            handler: ({ limit }) => {
              const rows = orders.listRecent(limit ?? 50).map((o) => ({ ...o }));
              return {
                query: 'orders_recent',
                rows,
                truncated: false,
              };
            },
          },
        ],
      });
      this.logger.log(
        `Code Sentry data-query registered → ${this.dataQueryHandle.callbackUrl} (listen :${this.dataQueryHandle.port}) queries=order_by_id,orders_recent`,
      );
    } catch (err) {
      this.logger.error(
        `Code Sentry data-query register failed → ${cs.dataPublicBaseUrl}`,
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
    getClient()?.stopConnectivityHeartbeat();
    resetClient();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.dataQueryHandle) {
      await this.dataQueryHandle.stop();
      this.dataQueryHandle = undefined;
    }
    if (this.logQueryHandle) {
      await this.logQueryHandle.stop();
      this.logQueryHandle = undefined;
    }
    getClient()?.stopConnectivityHeartbeat();
    resetClient();
    this.ready = false;
  }
}
