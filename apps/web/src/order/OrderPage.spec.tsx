import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderPage } from './OrderPage';

vi.mock('../api/client', () => ({
  listOrders: vi.fn().mockResolvedValue([]),
  createOrder: vi.fn().mockResolvedValue({
    id: 'ord_abc',
    sku: 'SKU-1',
    qty: 1,
    createdAt: '2026-11-09T00:00:00.000Z',
  }),
  triggerBoom: vi.fn().mockRejectedValue({
    response: { data: { message: 'Internal server error' } },
  }),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <OrderPage />
    </QueryClientProvider>,
  );
}

describe('OrderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders demo title and chaos actions', async () => {
    renderPage();
    expect(
      await screen.findByRole('heading', { name: /订单演示/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下单' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Boom 默认' }),
    ).toBeInTheDocument();
  });

  it('submits place order', async () => {
    const user = userEvent.setup();
    const { createOrder } = await import('../api/client');
    renderPage();
    await user.click(await screen.findByRole('button', { name: '下单' }));
    expect(createOrder).toHaveBeenCalled();
  });
});
