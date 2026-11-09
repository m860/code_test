export type AppConfig = {
  port: number;
  codeSentry: {
    baseUrl: string;
    webhookToken: string;
    environment: string;
    service: string;
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

  return {
    port: Number(process.env.PORT ?? 3100),
    codeSentry: {
      baseUrl: process.env.CODE_SENTRY_BASE_URL?.trim() ?? '',
      webhookToken: process.env.CODE_SENTRY_WEBHOOK_TOKEN?.trim() ?? '',
      environment: process.env.CODE_SENTRY_ENVIRONMENT?.trim() || 'test',
      service: process.env.CODE_SENTRY_SERVICE?.trim() || 'code-test-api',
    },
    demo: { flakyRate },
  };
};
