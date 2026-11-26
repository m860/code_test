import { Alert, Box, Button, Typography } from '@mui/material';
import { captureException } from '@code-sentry/browser';
import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Business ErrorBoundary → captureException (SDK has no official React boundary). */
export class SentryErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    void captureException(error, {
      tags: { source: 'react-error-boundary' },
      extra: { componentStack: info.componentStack },
    });
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <Box sx={{ p: 3, maxWidth: 560, mx: 'auto' }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            前端渲染错误已上报 Code Sentry（若已配置接入 Key）
          </Alert>
          <Typography variant="body2" sx={{ mb: 2, fontFamily: 'monospace' }}>
            {this.state.error.message}
          </Typography>
          <Button
            variant="outlined"
            onClick={() => this.setState({ error: null })}
          >
            重试
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
