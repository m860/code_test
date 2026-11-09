import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useState } from 'react';
import {
  createOrder,
  listOrders,
  triggerBoom,
  type BoomKind,
} from '../api/client';

function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (
      err as { response?: { data?: { message?: string | string[] } } }
    ).response?.data;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
  }
  if (err instanceof Error) return err.message;
  return '请求失败';
}

const PRESETS: { label: string; sku: string; qty: number; hint: string }[] = [
  { label: '正常下单', sku: 'SKU-100', qty: 1, hint: '可能仍被随机 flaky 打中' },
  { label: 'FAIL 业务 400', sku: 'FAIL', qty: 1, hint: '主动 reportError' },
  { label: 'CRASH TypeError', sku: 'CRASH', qty: 1, hint: '过滤器上报 5xx' },
  { label: 'NULL 空指针', sku: 'NULL', qty: 1, hint: '过滤器上报 5xx' },
  { label: 'REF 引用错误', sku: 'REF', qty: 1, hint: '过滤器上报 5xx' },
  { label: 'FLAKY 必挂', sku: 'FLAKY', qty: 1, hint: '随机一类 chaos' },
  { label: 'qty=99 库存', sku: 'SKU-100', qty: 99, hint: 'inventory chaos' },
];

const BOOMS: { label: string; kind: BoomKind }[] = [
  { label: 'Boom 默认', kind: 'default' },
  { label: 'Boom TypeError', kind: 'type_error' },
  { label: 'Boom 空指针', kind: 'null_deref' },
  { label: 'Boom 库存', kind: 'inventory' },
  { label: 'Boom 支付超时', kind: 'payment_timeout' },
];

export function OrderPage() {
  const queryClient = useQueryClient();
  const [sku, setSku] = useState('SKU-100');
  const [qty, setQty] = useState('1');
  const [banner, setBanner] = useState<{
    severity: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const ordersQuery = useQuery({
    queryKey: ['orders'],
    queryFn: listOrders,
  });

  const placeMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: (order) => {
      setBanner({
        severity: 'success',
        text: `下单成功 ${order.id}（若配置了 token，本次未上报错误）`,
      });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err) => {
      setBanner({
        severity: 'error',
        text: `下单失败 → 请到 Code Sentry 核对事件：${errorMessage(err)}`,
      });
    },
  });

  const boomMutation = useMutation({
    mutationFn: (kind: BoomKind) => triggerBoom(kind),
    onSuccess: () => {
      setBanner({ severity: 'info', text: '意外：boom 未返回错误' });
    },
    onError: (err) => {
      setBanner({
        severity: 'error',
        text: `已触发 500 → 请到 Code Sentry 查看：${errorMessage(err)}`,
      });
    },
  });

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background:
          'radial-gradient(ellipse at top left, #d1fae5 0%, transparent 45%), linear-gradient(160deg, #f4f7f6 0%, #e8eef0 100%)',
        py: 6,
      }}
    >
      <Container maxWidth="md">
        <Stack spacing={3}>
          <Box>
            <Typography variant="overline" color="primary">
              code_test · 人工联调
            </Typography>
            <Typography variant="h4" component="h1" gutterBottom>
              订单演示（故意留坑）
            </Typography>
            <Typography color="text.secondary">
              默认约 35% 下单会随机挂（
              <code>DEMO_FLAKY_RATE</code>
              ）。用下方预设可稳定复现各类上报；列表刷新也有较低概率挂。
            </Typography>
          </Box>

          <Alert severity="info">
            操作后打开 Code Sentry 管理端，确认对应应用是否出现新事件（message /
            stack / tags / request_id）。
          </Alert>

          {banner ? (
            <Alert
              severity={banner.severity}
              onClose={() => setBanner(null)}
            >
              {banner.text}
            </Alert>
          ) : null}

          <Box
            sx={{
              p: 3,
              bgcolor: 'background.paper',
              borderRadius: 2,
              boxShadow: '0 12px 40px rgba(15, 118, 110, 0.08)',
            }}
          >
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              一键预设（写入表单并下单）
            </Typography>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} mb={2}>
              {PRESETS.map((p) => (
                <Chip
                  key={p.label}
                  label={p.label}
                  onClick={() => {
                    setSku(p.sku);
                    setQty(String(p.qty));
                    placeMutation.mutate({ sku: p.sku, qty: p.qty });
                  }}
                  variant="outlined"
                  color={p.sku === 'SKU-100' && p.qty === 1 ? 'primary' : 'warning'}
                  title={p.hint}
                />
              ))}
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              强制 500（过滤器上报）
            </Typography>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} mb={2}>
              {BOOMS.map((b) => (
                <Button
                  key={b.kind}
                  size="small"
                  variant="outlined"
                  color="error"
                  disabled={boomMutation.isPending}
                  onClick={() => boomMutation.mutate(b.kind)}
                >
                  {b.label}
                </Button>
              ))}
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Stack
              component="form"
              spacing={2}
              onSubmit={(e) => {
                e.preventDefault();
                placeMutation.mutate({
                  sku,
                  qty: Number(qty),
                });
              }}
            >
              <TextField
                label="SKU"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                fullWidth
                required
                helperText="FAIL / CRASH / NULL / REF / FLAKY"
              />
              <TextField
                label="数量"
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                fullWidth
                required
                inputProps={{ min: 1, step: 1 }}
                helperText="≥ 99 必触发库存 chaos"
              />
              <Button
                type="submit"
                variant="contained"
                disabled={placeMutation.isPending}
              >
                下单
              </Button>
            </Stack>
          </Box>

          <Box>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              mb={1}
            >
              <Typography variant="h6">最近订单</Typography>
              <Button
                size="small"
                onClick={() => void ordersQuery.refetch()}
                disabled={ordersQuery.isFetching}
              >
                刷新（也可能随机挂）
              </Button>
            </Stack>
            {ordersQuery.isLoading ? (
              <Typography color="text.secondary">加载中…</Typography>
            ) : null}
            {ordersQuery.isError ? (
              <Alert severity="warning">
                列表失败（若已上报请到 Code Sentry 查看）：
                {errorMessage(ordersQuery.error)}
              </Alert>
            ) : null}
            <Stack spacing={1.5}>
              {(ordersQuery.data ?? []).map((order) => (
                <Box
                  key={order.id}
                  sx={{
                    px: 2,
                    py: 1.5,
                    bgcolor: 'background.paper',
                    borderRadius: 1.5,
                  }}
                >
                  <Typography fontWeight={600}>
                    {order.id} · {order.sku} × {order.qty}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {dayjs(order.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                  </Typography>
                </Box>
              ))}
              {ordersQuery.data?.length === 0 ? (
                <Typography color="text.secondary">暂无订单</Typography>
              ) : null}
            </Stack>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
