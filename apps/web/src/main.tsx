import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initBrowserSentry } from './sentry';
import { SentryErrorBoundary } from './SentryErrorBoundary';
import { theme } from './theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

void initBrowserSentry().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <SentryErrorBoundary>
            <App />
          </SentryErrorBoundary>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
});
