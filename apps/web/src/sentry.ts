import { init, ping } from '@code-sentry/browser';

/**
 * Browser SDK: auto-captures script errors + unhandledrejection.
 * Token will appear in the frontend bundle — isolate by env and rotate as needed.
 */
export async function initBrowserSentry(): Promise<boolean> {
  const baseUrl = import.meta.env.VITE_CODE_SENTRY_BASE_URL?.trim();
  const webhookToken = import.meta.env.VITE_CODE_SENTRY_WEBHOOK_TOKEN?.trim();
  const environment =
    import.meta.env.VITE_CODE_SENTRY_ENVIRONMENT?.trim() || 'test';
  const service =
    import.meta.env.VITE_CODE_SENTRY_SERVICE?.trim() || 'code-test-web';

  if (!baseUrl || !webhookToken) {
    console.warn(
      '[code-sentry/browser] skipped: set VITE_CODE_SENTRY_BASE_URL and VITE_CODE_SENTRY_WEBHOOK_TOKEN',
    );
    return false;
  }

  init({
    baseUrl,
    webhookToken,
    environment,
    service,
    // autoCapture: true (default)
  });

  try {
    const result = await ping();
    console.info(
      `[code-sentry/browser] ping ok → ${baseUrl} project=${result.name}(${result.projectId}) service=${service}`,
    );
    return true;
  } catch (err) {
    console.error('[code-sentry/browser] ping failed; auto-capture may still run', err);
    return false;
  }
}
