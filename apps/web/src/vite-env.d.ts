/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_CODE_SENTRY_BASE_URL?: string;
  readonly VITE_CODE_SENTRY_WEBHOOK_TOKEN?: string;
  readonly VITE_CODE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_CODE_SENTRY_SERVICE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
