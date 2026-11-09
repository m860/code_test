import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../config/configuration';
import { SentryService } from '../sentry/sentry.service';
import type { CreateOrderDto } from './dto/create-order.dto';
import {
  CHAOS_SKUS,
  pickChaosKind,
  shouldFlaky,
  throwChaos,
  type ChaosKind,
} from './order-chaos';

export type Order = {
  id: string;
  sku: string;
  qty: number;
  createdAt: string;
};

@Injectable()
export class OrderService {
  private readonly orders: Order[] = [];

  constructor(
    private readonly sentry: SentryService,
    private readonly config: ConfigService,
  ) {}

  private flakyRate(): number {
    return this.config.get<AppConfig['demo']>('demo')?.flakyRate ?? 0.35;
  }

  list(): Order[] {
    // Intentional: listing occasionally blows up → filter reports 5xx
    if (shouldFlaky(this.flakyRate() * 0.5)) {
      throwChaos('inventory');
    }
    return [...this.orders].reverse();
  }

  async create(dto: CreateOrderDto, requestId?: string): Promise<Order> {
    const sku = dto.sku.trim();
    const upper = sku.toUpperCase();

    if (!sku) {
      const err = new BadRequestException('sku is required');
      await this.sentry.reportError(err, {
        request_id: requestId,
        tags: { feature: 'placeOrder', reason: 'validation' },
      });
      throw err;
    }

    if (upper === CHAOS_SKUS.FAIL) {
      const err = new BadRequestException('SKU FAIL is blocked by demo rule');
      await this.sentry.reportError(err, {
        request_id: requestId,
        tags: { feature: 'placeOrder', reason: 'business_rule' },
      });
      throw err;
    }

    if (upper === CHAOS_SKUS.CRASH) {
      throwChaos('type_error');
    }
    if (upper === CHAOS_SKUS.REF) {
      // Intentional undeclared access via Function to mimic ReferenceError-ish
      // eslint-disable-next-line no-new-func
      Function('return missingWarehouseCode.length')();
      throw new Error('unreachable');
    }
    if (upper === CHAOS_SKUS.NULL) {
      throwChaos('null_deref');
    }

    // qty >= 99 always inventory chaos (deterministic for manual test)
    if (dto.qty >= 99) {
      throwChaos('inventory');
    }

    const forceFlaky = upper === CHAOS_SKUS.FLAKY;
    if (forceFlaky || shouldFlaky(this.flakyRate())) {
      throwChaos(pickChaosKind());
    }

    const order: Order = {
      id: `ord_${randomUUID().slice(0, 8)}`,
      sku,
      qty: dto.qty,
      createdAt: new Date().toISOString(),
    };
    this.orders.push(order);
    return order;
  }

  /**
   * Force an unexpected failure. Global SentryExceptionFilter reports 5xx.
   */
  boom(kind: 'default' | ChaosKind = 'default'): never {
    if (kind === 'default') {
      throw new Error('demo boom: intentional server failure');
    }
    throwChaos(kind);
  }
}
