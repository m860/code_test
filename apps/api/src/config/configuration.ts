export type AppConfig = {
  port: number;
  codeSentry: {
    baseUrl: string;
    webhookToken: string;
    environment: string;
    service: string;
    /**
     * Base URL Code Sentry can reach for log-query callback (scheme+host+port, no path).
     * Must match CODE_SENTRY_LOG_QUERY_PORT.
     */
    publicBaseUrl: string;
    /** Dedicated listen port for SDK log-query HTTP (separate from Nest PORT). */
    logQueryPort: number;
  };
  demo: {
    /** Probability of random failure on create (0–1). Default 0.35 for manual E2E. */
    flakyRate: number;
  };
};

export default (): AppConfig => {
  const raw = process.env.DEMO_FLAKY_RATE?.trim();
  const parsed = raw === undefined || raw === '' ? 0.35 : Number(raw);
  const flakyRate = Number.isFinite(parsed)
    ? Math.min(1, Math.max(0, parsed))
    : 0.35;

  const logQueryPort = Number(process.env.CODE_SENTRY_LOG_QUERY_PORT ?? 3110);
  const publicBaseUrl =
    process.env.CODE_SENTRY_PUBLIC_BASE_URL?.trim() ||
    `http://127.0.0.1:${Number.isFinite(logQueryPort) ? logQueryPort : 3110}`;

  return {
    port: Number(process.env.PORT ?? 3100),
    codeSentry: {
      baseUrl: process.env.CODE_SENTRY_BASE_URL?.trim() ?? '',
      webhookToken: process.env.CODE_SENTRY_WEBHOOK_TOKEN?.trim() ?? '',
      environment: process.env.CODE_SENTRY_ENVIRONMENT?.trim() || 'test',
      service: process.env.CODE_SENTRY_SERVICE?.trim() || 'code-test-api',
      publicBaseUrl,
      logQueryPort: Number.isFinite(logQueryPort) ? logQueryPort : 3110,
    },
    demo: { flakyRate },
  };
};
