import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL?.trim() || '';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

export type Order = {
  id: string;
  sku: string;
  qty: number;
  createdAt: string;
};

export type BoomKind =
  | 'default'
  | 'type_error'
  | 'null_deref'
  | 'inventory'
  | 'payment_timeout';

export async function listOrders(): Promise<Order[]> {
  const { data } = await api.get<Order[]>('/v1/orders');
  return data;
}

export async function createOrder(input: {
  sku: string;
  qty: number;
}): Promise<Order> {
  const { data } = await api.post<Order>('/v1/orders', input, {
    headers: { 'x-request-id': `web-${Date.now()}` },
  });
  return data;
}

export async function triggerBoom(kind: BoomKind = 'default'): Promise<void> {
  await api.post(
    `/v1/orders/boom`,
    {},
    {
      params: kind === 'default' ? undefined : { kind },
      headers: { 'x-request-id': `boom-${Date.now()}` },
    },
  );
}
