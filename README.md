# code_test

Code Sentry 人工联调演示：NestJS API + React Web，订单域**故意留坑**，方便点一点就出上报事件。

## 准备

```bash
pnpm install
cp .env.example .env
# 填 CODE_SENTRY_WEBHOOK_TOKEN；按需改 DEMO_FLAKY_RATE
pnpm dev
```

- API：http://localhost:3100  
- Web：http://localhost:5175  
- Code Sentry API 默认：http://localhost:3001  

## 人工怎么测

1. Code Sentry 管理端建应用，把一次性 `webhookToken` 写入 `.env`，重启 API。  
2. 打开 Web，用「一键预设」或 Boom 按钮触发错误。  
3. 到 Code Sentry 看是否出现事件（message / stack / tags / request_id）。

| 操作 | 预期 |
|------|------|
| 普通下单 | ~35% 随机 5xx（`DEMO_FLAKY_RATE`）并上报 |
| SKU `FAIL` | 400 + 主动 `reportError` |
| SKU `CRASH` / `NULL` / `REF` | 5xx + 过滤器上报（不同异常类型） |
| SKU `FLAKY` | 必走随机 chaos |
| qty ≥ 99 | 库存 chaos 5xx |
| Boom 按钮 | 指定 kind 的 5xx |
| 刷新列表 | 较低概率 inventory 失败 |

把 `DEMO_FLAKY_RATE=0` 可关掉随机，只测预设/Boom。

## 测试

```bash
pnpm test
```
