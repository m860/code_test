---
name: code-sentry-integrate
description: >-
  Integrate a protected app with Code Sentry: obtain webhook Key, install
  @code-sentry/node or call HTTP ingest, ping verification, optional
  registerLogQuery / registerDataQuery for on-demand logs and named data.
  Use when wiring Code Sentry into an application, SDK 接入, 接入 Key,
  ingest events, or Agent log/data query registration.
---

# Code Sentry 应用接入

把**被守护应用**接到已部署的 Code Sentry（管理面与 `/api/v1` 同源）。

下文 **`{BASE}`** = Code Sentry 根地址（无尾斜杠），例如 `http://172.16.0.199:8088`。向用户确认实际 `{BASE}` 与接入 Key。

## 1. 管理面拿接入 Key

1. 打开 `{BASE}/` 登录管理面。
2. 创建或打开目标**应用** → **接入**。
3. 复制 **接入 Key**（请求头 `x-webhook-token`）。没有明文时先「重新签发」。
4. 建议点「发送测试」：应探测成功且**不**写入错误事件。

需要：`{BASE}`、接入 Key、应用下至少一个 Git 仓库（分析/对话用）。**不要**把真实 Key 写进业务仓库明文。

## 2. Node SDK（推荐）

### 依赖

```bash
pnpm add @code-sentry/node
# 或 npm i / yarn add
```

含 `registerLogQuery` 时包版本需 ≥ 0.4.0；含 `registerDataQuery` 需 ≥ 0.5.0（以实际可装源为准）。

### 最短上报

```ts
import { init, ping, captureException } from '@code-sentry/node';

init({
  baseUrl: '{BASE}',           // 不要带 /api/v1
  webhookToken: '<接入Key>',
  environment: 'production',   // 必填
  service: 'order-api',        // 建议：与日志源 service 同名
});

await ping(); // 失败会抛错；用于验收

try {
  // ...
} catch (err) {
  void captureException(err);
  throw err;
}
```

| 项 | 值 |
| --- | --- |
| 上报 | `POST {BASE}/api/v1/ingest/events` |
| 探测 | `POST {BASE}/api/v1/ingest/ping` |
| 头 | `x-webhook-token: <接入Key>` |
| 级别 | v1 **仅 `error`** 入分析；其它 level 会被忽略 |

SDK **不**装全局 uncaught 钩子；在业务 catch / 中间件里调 `captureException` / `captureMessage`。

### 可选：按需日志查询（Agent 回查）

哨兵**不存**日志正文；应用侧提供查询口，分析 / 钉钉对话按需拉取。

```ts
import { registerLogQuery } from '@code-sentry/node';

const handle = await registerLogQuery({
  service: 'order-api', // 同一应用内唯一；upsert
  // 哨兵进程必须能 HTTP 访问到的本服务地址（含端口，无 path）
  publicBaseUrl: 'https://<本服务对外可达地址>',
  // listenPort / path 可选；默认挂 /__code_sentry/logs/query
  query: async ({ from, to, levels, keywords, traceId, requestId, limit }) => {
    // 自行查文件 / Loki / 其它
    return {
      lines: [
        // { timestamp, level, message, fields? }
      ],
      truncated: false,
    };
  },
});

// 进程退出时可 await handle.stop()（unregister + 关本地 HTTP）
```

- 登记/心跳：`{BASE}/api/v1/ingest/log-sources/*`，鉴权同接入 Key。
- SDK 默认约 90s 心跳；服务端 TTL 默认 5 分钟无心跳视为过期，Agent 不可查。
- `publicBaseUrl` 必须是**哨兵能打到**的地址。
- 同 `service` 再次登记会覆盖 callback。
- 管理面「日志查询」Tab **只读**，不在 UI 配 URL。

### 可选：数据命名查询（`registerDataQuery`）

排障需要对照业务数据时，用**命名查询**（不是任意 SQL）。登记方式与日志同源（Key、心跳、按 `service`）。

**选型建议（优先）：** 命名查询的 handler **优先暴露/复用服务里已有的业务 Service（或应用层用例）**，做成只读探针，而不是另写一套查库逻辑。已有方法往往已含鉴权边界、组装与脱敏习惯，补查询更快、行为也更一致。

- 例：已有 `OrderService.getById` → 登记 `order_by_id`，handler 内直接调它（再裁剪字段/`limit`）。  
- 避免：为哨兵单独写裸 SQL / 新 Repository，与线上读路径分叉。  
- 仍按需少量新增；先覆盖错误上下文里常见的 id（订单号、用户 id 等）。

```ts
import { registerDataQuery } from '@code-sentry/node';
// 假设应用内已有：
// import { orderService } from './services/order.service';

const handle = await registerDataQuery({
  service: 'order-api', // 可与日志源同名；两套登记互不影响
  publicBaseUrl: 'https://<本服务对外可达地址>',
  // listenPort / path 可选；默认挂 /__code_sentry/data/query
  queries: [
    {
      name: 'order_by_id',
      description: '按订单号查订单摘要',
      params: ['orderId'],
      handler: async ({ params, limit }) => {
        const orderId = String(params.orderId ?? '');
        // 优先复用已有 Service，勿另写裸 SQL
        const order = await orderService.getById(orderId);
        return {
          rows: order ? [order] : [],
          truncated: false,
        };
      },
    },
  ],
});

// 进程退出时可 await handle.stop()
```

- 登记/心跳：`{BASE}/api/v1/ingest/data-sources/*`，鉴权同接入 Key。
- 心跳与 TTL 同日志源（默认约 90s / 5 分钟）。
- 管理面「数据查询」Tab **只读**，不配 URL / SQL。
- Agent 经哨兵按名回查；目录非空时未登记的 query 名会被拒绝。

## 3. 纯 HTTP（无 SDK）

```bash
# 探测（不落事件）
curl -sS -X POST "{BASE}/api/v1/ingest/ping" \
  -H "x-webhook-token: <接入Key>"

# 上报错误
curl -sS -X POST "{BASE}/api/v1/ingest/events" \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: <接入Key>" \
  -d '{
    "timestamp": "2026-11-20T00:00:00.000Z",
    "level": "error",
    "message": "NullPointerException at OrderService.pay",
    "environment": "prod",
    "service": "order-api",
    "stack": "at OrderService.pay(...)\\n..."
  }'
```

日志源登记（可选）：

- `POST {BASE}/api/v1/ingest/log-sources/register` — `{ "service", "callbackUrl", "meta"? }`
- `POST .../heartbeat` — `{ "service", "callbackUrl"? }`
- `POST .../unregister` — `{ "service" }`

应用 callback：`POST {callbackUrl}`，头带同一 `x-webhook-token`，body 含 `from`/`to`/可选过滤与 `limit`；响应 `{ lines, truncated? }`。

数据源登记（可选）：

- `POST {BASE}/api/v1/ingest/data-sources/register` — `{ "service", "callbackUrl", "queries"?, "meta"? }`
- `POST .../heartbeat` — `{ "service", "callbackUrl"?, "queries"? }`
- `POST .../unregister` — `{ "service" }`

应用 callback：`POST {callbackUrl}`，头带同一 `x-webhook-token`，body `{ "query", "params"?, "limit"? }`；响应 `{ query?, rows, truncated? }`。

## 4. 验收

1. `ping` 返回 `ok: true` 且 `projectId` 对得上。  
2. 故意上报一条 error → 管理面事件可见 → 分析可排队。  
3. （可选）`registerLogQuery` 后，「日志查询」出现该服务且在线。  
4. （可选）`registerDataQuery` 后，「数据查询」出现该服务、命名列表且在线。  
5. 重新签发 Key 后旧 Key 失效；应用侧换成新 Key 再 `init` / 登记。

## 5. 常见失败

| 现象 | 处理 |
| --- | --- |
| 401/403 | Key 错、未带头、或已轮换 |
| 上报成功但不分析 | `level` 非 error；或未配仓库 / LLM |
| 日志/数据源过期 | 无心跳；检查进程与 `publicBaseUrl` 可达性 |
| Agent 查日志失败 | 源过期、callback 超时/5xx、或时间窗超上限 |
| Agent 查数据失败 | 源过期、未知 query 名、callback 超时/5xx |

## 6. 执行约束

- 优先改**业务应用**完成接入；不要改 Code Sentry 服务端来代替接入。  
- 未要求时不要部署 / 发版 Code Sentry 本身。
