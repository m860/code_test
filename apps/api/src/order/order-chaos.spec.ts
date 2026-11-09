import {
  pickChaosKind,
  shouldFlaky,
  throwChaos,
} from './order-chaos';

describe('order-chaos', () => {
  it('shouldFlaky respects rate bounds', () => {
    expect(shouldFlaky(0, () => 0)).toBe(false);
    expect(shouldFlaky(1, () => 0.99)).toBe(true);
    expect(shouldFlaky(0.5, () => 0.49)).toBe(true);
    expect(shouldFlaky(0.5, () => 0.5)).toBe(false);
  });

  it('pickChaosKind returns a known kind', () => {
    expect(pickChaosKind(() => 0)).toBe('type_error');
  });

  it('throwChaos inventory message', () => {
    expect(() => throwChaos('inventory')).toThrow(/inventory sync failed/);
  });
});
