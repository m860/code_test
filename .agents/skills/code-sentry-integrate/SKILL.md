---
name: code-sentry-integrate
description: >-
  Integrate a protected app with Code Sentry: obtain webhook Key, install
  @code-sentry/browser (Web auto-capture), @code-sentry/node, or Java
  code-sentry-java (jar handoff), or call HTTP ingest; ping verification;
  per-service SDK connectivity heartbeat (Node/Java); optional registerLogQuery
  / registerDataQuery for on-demand logs and named data. Use when wiring Code
  Sentry into an application, SDK 接入, Web/browser/Java SDK, 接入 Key, ingest
  events, connectivity heartbeat, or Agent log/data query registration.
---

# Code Sentry 应用接入

把**被守护应用**接到已部署的 Code Sentry（管理面与 `/api/v1` 同源）。

下文 **`{BASE}`** = Code Sentry 根地址（无尾斜杠），例如 `http://172.16.0.199:8088`。向用户确认实际 `{BASE}` 与接入 Key。

**人读入口：** 打开 `{BASE}/integrate`（**可匿名**；管理面接入弹窗「完整集成说明」新窗口打开）按运行时自助接入；Java jar 可从该页或 `{BASE}/downloads/code-sentry-java-*.jar` 下载。接入 Key 仍须登录后在应用「接入」中复制。

## 1. 管理面拿接入 Key

1. 打开 `{BASE}/` 登录管理面。
2. 创建或打开目标**应用** → **接入**。
3. 复制 **接入 Key**（请求头 `x-webhook-token`）。没有明文时先「重新签发」。
4. 建议点「发送测试」：应探测成功且**不**写入错误事件。

需要：`{BASE}`、接入 Key、应用下至少一个 Git 仓库（分析/对话用）。**不要**把真实 Key 写进业务仓库明文（浏览器 SDK 例外：Key 会出现在前端包，按环境隔离并支持轮换）。

## 2. 选型

| 运行时 | 包 | 默认拦截 | SDK 连通心跳 | 查日志 / 查数据 |
| --- | --- | --- | --- | --- |
| 浏览器 / 前端 | `@code-sentry/browser` | 是（脚本错误 + `unhandledrejection`） | **无**（规划中） | **无**（不做） |
| Node 服务端 | `@code-sentry/node` ≥ 0.6.0 | 否（业务自行 `capture*`） | `init({ service })` 自动 | 可选 `registerLogQuery` / `registerDataQuery` |
| Java 8+（任意框架） | `io.codesentry:code-sentry-java`（单 jar 交付，不发 Central） | 否（业务自行 `captureException`） | `setService` 后自动 | 可选 `registerLogQuery` / `registerDataQuery` |
| 任意 | 纯 HTTP | — | 须自行打 `connectivity/heartbeat` | 可选（自建 callback） |

入站契约相同：`POST {BASE}/api/v1/ingest/events` + `x-webhook-token`；v1 **仅 `level=error`** 入分析。

**SDK 连通（按服务）：** 同一应用可有多个 `service` 名。Node / Java 在配置稳定 `service` 后会周期上报 `POST {BASE}/api/v1/ingest/connectivity/heartbeat`（默认约 60s；服务端 TTL 默认 5 分钟）。管理面概览「状态」、应用 Tab「服务能力」按服务展示连通与能力四列。Agent `query_logs` / `query_data` **必须**目标 service 连通在线，再校验日志/数据登记（不再用日志/数据源级 TTL 作门槛）。browser **不做**连通心跳。

## 3. Browser / Web SDK

### 依赖

```bash
pnpm add @code-sentry/browser
# 或 npm i / yarn add
```

### 最短上报

```ts
import { init, ping, captureException, close } from '@code-sentry/browser';

init({
  baseUrl: '{BASE}',           // 不要带 /api/v1
  webhookToken: '<接入Key>',   // 会出现在前端产物；按环境隔离
  environment: 'production',   // 必填
  service: 'web-app',          // 建议
  // autoCapture: true 为默认
});

await ping(); // 失败会抛错；用于验收

// 业务主动上报（如自建 React ErrorBoundary → componentDidCatch）
void captureException(err);

// SPA 卸载 / 测试时可 close() 卸监听
```

| 项 | 值 |
| --- | --- |
| 上报 | `POST {BASE}/api/v1/ingest/events` |
| 探测 | `POST {BASE}/api/v1/ingest/ping` |
| 头 | `x-webhook-token: <接入Key>` |
| 默认监听 | `error`（仅 `event.error instanceof Error`）+ `unhandledrejection` |
| 关闭自动拦截 | `init({ autoCapture: false })`；卸监听 `close()` |

- **不做**资源加载失败 / `fetch` 包装拦截。  
- **不做** `registerLogQuery` / `registerDataQuery`。  
- **不做**连通心跳（browser 规划中）。  
- **不做**官方 React ErrorBoundary；渲染期错误在业务边界内调 `captureException`。

## 4. Node SDK

### 依赖

```bash
pnpm add @code-sentry/node
# 或 npm i / yarn add
```

含 `registerLogQuery` 时包版本需 ≥ 0.4.0；含 `registerDataQuery` 需 ≥ 0.5.0；`init({ service })` **自动连通心跳**需 ≥ **0.6.0**（以实际可装源为准）。

### 最短上报

```ts
import { init, ping, captureException } from '@code-sentry/node';

init({
  baseUrl: '{BASE}',           // 不要带 /api/v1
  webhookToken: '<接入Key>',
  environment: 'production',   // 必填
  service: 'order-api',        // 强烈建议：稳定服务名；启用连通心跳；与 register* 同名
  // connectivityHeartbeatIntervalMs: 60_000, // 默认 60s；设 0 关闭自动心跳
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
| 连通 | 有 `service` 时自动 `POST {BASE}/api/v1/ingest/connectivity/heartbeat` |
| 头 | `x-webhook-token: <接入Key>` |
| 级别 | v1 **仅 `error`** 入分析；其它 level 会被忽略 |

SDK **不**装全局 uncaught 钩子；在业务 catch / 中间件里调 `captureException` / `captureMessage`。

配置了 `service` 后进程内自动连通心跳（默认约 60s，远小于服务端默认 5 分钟 TTL）。管理面「状态 / 服务能力」应出现该服务且「已连通」。测试可 `connectivityHeartbeatIntervalMs: 0` 关闭，或手动 `client.sendConnectivityHeartbeat()`。

### 可选：按需日志查询（Agent 回查）— Node / Java

哨兵**不存**日志正文；应用侧提供查询口，分析 / 钉钉对话按需拉取。`service` 须与连通心跳、数据登记共用同一套命名。

```ts
import { registerLogQuery } from '@code-sentry/node';

const handle = await registerLogQuery({
  service: 'order-api', // 同一应用内唯一；upsert；须与 init.service 一致以便能力「日志可用」
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

- 登记/保鲜心跳：`{BASE}/api/v1/ingest/log-sources/*`，鉴权同接入 Key（登记用，**不**替代连通心跳）。
- Agent 回查门槛：**该 service SDK 连通在线** + 已登记；仅有登记、无连通心跳 → 不可查。
- `publicBaseUrl` 必须是**哨兵能打到**的地址。
- 同 `service` 再次登记会覆盖 callback。
- 管理面「日志查询」只读登记明细；是否可查看「服务能力」四列。

### 可选：数据命名查询（`registerDataQuery`）— Node / Java

排障需要对照业务数据时，用**命名查询**（不是任意 SQL）。登记方式与日志同源（Key、按 `service`）。

**选型建议（优先）：** 命名查询的 handler **优先暴露/复用服务里已有的业务 Service（或应用层用例）**，做成只读探针，而不是另写一套查库逻辑。已有方法往往已含鉴权边界、组装与脱敏习惯，补查询更快、行为也更一致。

- 例：已有 `OrderService.getById` → 登记 `order_by_id`，handler 内直接调它（再裁剪字段/`limit`）。  
- 避免：为哨兵单独写裸 SQL / 新 Repository，与线上读路径分叉。  
- 仍按需少量新增；先覆盖错误上下文里常见的 id（订单号、用户 id 等）。

```ts
import { registerDataQuery } from '@code-sentry/node';
// 假设应用内已有：
// import { orderService } from './services/order.service';

const handle = await registerDataQuery({
  service: 'order-api', // 可与日志源同名；两套登记互不影响；须与 init.service 一致
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

- 登记/保鲜心跳：`{BASE}/api/v1/ingest/data-sources/*`，鉴权同接入 Key。
- Agent 回查门槛：**该 service SDK 连通在线** + 已登记（目录非空时还须 query 名合法）。
- 管理面「数据查询」只读；是否可查看「服务能力」。

## 5. Java SDK（Java 8+，框架无关）

### 依赖（不发布 Central；交付 jar）

优先从已部署实例下载（发版包含 downloads）：

- 帮助页：`{BASE}/integrate` → Java Tab →「下载」
- 直链：`{BASE}/downloads/code-sentry-java-0.1.0.jar`（版本随 SDK）

也可在 Code Sentry 仓构建：

```bash
cd packages/sdk-java && mvn -q package
# 产物 target/code-sentry-java-0.1.0.jar
```

接入方安装到本地仓库后按坐标引用，或把 jar 放入 `libs/`：

```bash
mvn install:install-file \
  -Dfile=code-sentry-java-0.1.0.jar \
  -DgroupId=io.codesentry \
  -DartifactId=code-sentry-java \
  -Dversion=0.1.0 \
  -Dpackaging=jar
```

```xml
<dependency>
  <groupId>io.codesentry</groupId>
  <artifactId>code-sentry-java</artifactId>
  <version>0.1.0</version>
</dependency>
```

零第三方依赖；单 jar。需完整 JDK（`register*` 使用 `com.sun.net.httpserver`）。

### 最短上报

```java
import io.codesentry.CodeSentry;
import io.codesentry.InitOptions;

CodeSentry.init(new InitOptions()
    .setBaseUrl("{BASE}")
    .setWebhookToken("<接入Key>")
    .setEnvironment("production")
    .setService("order-api") // 强烈建议：启用连通心跳；与 register* 同名
    // .setConnectivityHeartbeatIntervalMs(0) // 可选：关闭自动心跳
    );

CodeSentry.ping(); // 失败抛错；用于验收

try {
  // ...
} catch (Exception err) {
  CodeSentry.captureException(err);
  throw err;
}
```

| 项 | 值 |
| --- | --- |
| 上报 | `POST {BASE}/api/v1/ingest/events` |
| 探测 | `POST {BASE}/api/v1/ingest/ping` |
| 连通 | 有 `service` 时自动 `POST …/ingest/connectivity/heartbeat`（默认约 60s） |
| 头 | `x-webhook-token: <接入Key>` |
| 默认 | `language=java`、`runtime=jvm` |

SDK **不**装全局未捕获钩子；**不做**官方 Spring Boot Starter（可在 `@PostConstruct` 里显式 `init`，非框架绑定）。须使用**含连通心跳**的发版 jar（与 Node ≥ 0.6.0 同契约）。

### 可选：按需日志 / 数据查询

API 与 Node 同契约；Agent 回查同样要求该 `service` **SDK 连通在线**。示例：

```java
import io.codesentry.CodeSentry;
import io.codesentry.LogQuery;
import io.codesentry.RegisterHandle;

RegisterHandle handle = CodeSentry.registerLogQuery(new LogQuery.Options()
    .setService("order-api")
    .setPublicBaseUrl("https://<本服务对外可达地址>")
    .setQuery(new LogQuery.Handler() {
      public LogQuery.Response query(LogQuery.Request req) {
        return new LogQuery.Response(/* lines */, false);
      }
    }));
// 进程退出：handle.stop();
```

`registerDataQuery` 见包 README；登记路径与心跳同 Node。

## 6. 纯 HTTP（无 SDK）

```bash
# 探测（不落事件）
curl -sS -X POST "{BASE}/api/v1/ingest/ping" \
  -H "x-webhook-token: <接入Key>"

# 服务级 SDK 连通心跳（无 Node/Java SDK 时须自行周期调用；建议 ≤60s）
curl -sS -X POST "{BASE}/api/v1/ingest/connectivity/heartbeat" \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: <接入Key>" \
  -d '{ "service": "order-api" }'

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

日志源登记（可选；callbackUrl 须哨兵能打到；登记保鲜心跳 ≠ 连通心跳；Agent 回查还须该 service 连通在线）：

```bash
curl -sS -X POST "{BASE}/api/v1/ingest/log-sources/register" \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: <接入Key>" \
  -d '{
    "service": "order-api",
    "callbackUrl": "https://<本服务对外可达地址>/__code_sentry/logs/query"
  }'

curl -sS -X POST "{BASE}/api/v1/ingest/log-sources/heartbeat" \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: <接入Key>" \
  -d '{ "service": "order-api" }'
# unregister: POST .../log-sources/unregister  body { "service" }
```

应用 callback：`POST {callbackUrl}`，头带同一 `x-webhook-token`，body 含 `from`/`to`/可选过滤与 `limit`；响应 `{ lines, truncated? }`。

数据源登记（可选；命名查询，非任意 SQL）：

```bash
curl -sS -X POST "{BASE}/api/v1/ingest/data-sources/register" \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: <接入Key>" \
  -d '{
    "service": "order-api",
    "callbackUrl": "https://<本服务对外可达地址>/__code_sentry/data/query",
    "queries": [
      { "name": "order_by_id", "description": "按订单号查订单", "params": ["orderId"] }
    ]
  }'

curl -sS -X POST "{BASE}/api/v1/ingest/data-sources/heartbeat" \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: <接入Key>" \
  -d '{ "service": "order-api" }'
# unregister: POST .../data-sources/unregister  body { "service" }
```

应用 callback：`POST {callbackUrl}`，头带同一 `x-webhook-token`，body `{ "query", "params"?, "limit"? }`；响应 `{ query?, rows, truncated? }`。

## 7. 验收

1. `ping` 返回 `ok: true` 且 `projectId` 对得上。  
2. Node / Java：`init`/`setService` 后管理面概览「状态」或应用「服务能力」出现该 `service` 且 **已连通**（纯 HTTP：周期打 `connectivity/heartbeat`）。browser 无此项。  
3. 故意上报一条 error（Browser：触发脚本错或 `captureException`；Node / Java：`captureException`）→ 管理面事件可见 → 分析可排队。  
4. （可选）`registerLogQuery` 或 HTTP `log-sources/register` 后，「日志查询」有登记；「服务能力」该行「日志」为可用（须同时连通）。  
5. （可选）`registerDataQuery` 或 HTTP `data-sources/register` 后，「数据查询」有命名列表；「服务能力」该行「数据」为可用（须同时连通）。  
6. 重新签发 Key 后旧 Key 失效；应用侧换成新 Key 再 `init` / 登记 / 心跳。

## 8. 常见失败

| 现象 | 处理 |
| --- | --- |
| 401/403 | Key 错、未带头、或已轮换 |
| CORS / 浏览器预检失败 | 确认 `{BASE}` 可跨域；服务端需允许 `x-webhook-token` |
| 上报成功但不分析 | `level` 非 error；或未配仓库 / LLM |
| React 渲染错未上报 | 默认拦不到渲染树；在 ErrorBoundary 调 `captureException` |
| 「状态」长期未连通 | 未配 `service`、心跳被关、进程挂了、或 TTL（默认 5 分钟）内无 `connectivity/heartbeat` |
| Agent 查日志/数据失败 | 该 service **未连通**、未登记、未知 query 名、callback 超时/5xx、或时间窗超上限 |
| Java `register*` 起不来 | 需完整 JDK（含 `com.sun.net.httpserver`）；裁剪 JRE 仅核心 capture/ping |

## 9. 执行约束

- 优先改**业务应用**完成接入；不要改 Code Sentry 服务端来代替接入。  
- 未要求时不要部署 / 发版 Code Sentry 本身。
