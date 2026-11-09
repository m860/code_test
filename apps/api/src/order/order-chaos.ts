/**
 * Intentional demo defects for Code Sentry manual E2E.
 * Special SKUs / qty / flaky rate — not production logic.
 */

export const CHAOS_SKUS = {
  /** Always 400 + active reportError */
  FAIL: 'FAIL',
  /** Always TypeError (5xx via filter) */
  CRASH: 'CRASH',
  /** Always ReferenceError-style (5xx) */
  REF: 'REF',
  /** Always nested null dereference (5xx) */
  NULL: 'NULL',
  /** Force flaky path even if rate is 0 */
  FLAKY: 'FLAKY',
} as const;

export type ChaosKind =
  | 'type_error'
  | 'null_deref'
  | 'inventory'
  | 'payment_timeout';

const KINDS: ChaosKind[] = [
  'type_error',
  'null_deref',
  'inventory',
  'payment_timeout',
];

export function pickChaosKind(random = Math.random): ChaosKind {
  return KINDS[Math.floor(random() * KINDS.length)]!;
}

/** Throws an intentional unexpected error (no HttpException). */
export function throwChaos(kind: ChaosKind): never {
  switch (kind) {
    case 'type_error': {
      const bag: { price?: number } = {};
      // intentional: read missing field then call method
      void (bag as { price: number }).price.toFixed(2);
      throw new Error('unreachable');
    }
    case 'null_deref': {
      const order = null as unknown as { customer: { id: string } };
      return order.customer.id as never;
    }
    case 'inventory':
      throw new Error('demo chaos: inventory sync failed (warehouse-east)');
    case 'payment_timeout':
      throw new Error('demo chaos: payment gateway timeout after 3000ms');
    default: {
      const _exhaustive: never = kind;
      throw new Error(String(_exhaustive));
    }
  }
}

export function shouldFlaky(
  rate: number,
  random = Math.random,
): boolean {
  if (rate <= 0) return false;
  if (rate >= 1) return true;
  return random() < rate;
}
