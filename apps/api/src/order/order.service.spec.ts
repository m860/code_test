import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SentryService } from '../sentry/sentry.service';
import { OrderService } from './order.service';

describe('OrderService', () => {
  let service: OrderService;
  const sentry = {
    reportError: jest.fn().mockResolvedValue(undefined),
    reportMessage: jest.fn().mockResolvedValue(undefined),
    isReady: jest.fn().mockReturnValue(true),
    initFromConfig: jest.fn(),
    reset: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'demo') return { flakyRate: 0 };
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string) => {
      if (key === 'demo') return { flakyRate: 0 };
      return undefined;
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: SentryService, useValue: sentry },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(OrderService);
  });

  it('creates an order when flaky rate is 0', async () => {
    const order = await service.create({ sku: 'SKU-1', qty: 2 });
    expect(order.sku).toBe('SKU-1');
    expect(order.qty).toBe(2);
    expect(service.list()).toHaveLength(1);
    expect(sentry.reportError).not.toHaveBeenCalled();
  });

  it('reports and rejects SKU FAIL', async () => {
    await expect(
      service.create({ sku: 'FAIL', qty: 1 }, 'req-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(sentry.reportError).toHaveBeenCalledTimes(1);
    expect(sentry.reportError.mock.calls[0][1]).toMatchObject({
      request_id: 'req-1',
      tags: { feature: 'placeOrder', reason: 'business_rule' },
    });
  });

  it('CRASH throws TypeError for 5xx filter path', async () => {
    await expect(service.create({ sku: 'CRASH', qty: 1 })).rejects.toThrow(
      TypeError,
    );
  });

  it('qty >= 99 throws inventory chaos', async () => {
    await expect(service.create({ sku: 'SKU-1', qty: 99 })).rejects.toThrow(
      /inventory sync failed/,
    );
  });

  it('boom throws for filter / 5xx path', () => {
    expect(() => service.boom('default')).toThrow(/demo boom/);
    expect(sentry.reportError).not.toHaveBeenCalled();
  });

  it('random flaky can fire when rate is 1', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'demo') return { flakyRate: 1 };
      return undefined;
    });
    await expect(service.create({ sku: 'SKU-OK', qty: 1 })).rejects.toThrow();
  });
});
