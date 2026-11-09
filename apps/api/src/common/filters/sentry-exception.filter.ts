import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { SentryService } from '../../sentry/sentry.service';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  constructor(private readonly sentry: SentryService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Report unexpected 5xx (and non-HttpException) to Code Sentry
    if (status >= 500) {
      void this.sentry.reportError(exception, {
        request_id: request.headers['x-request-id'] as string | undefined,
        tags: {
          path: request.url,
          method: request.method,
          status,
        },
      });
      this.logger.error(
        `Unhandled ${status} ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(
      typeof message === 'string'
        ? { statusCode: status, message }
        : message,
    );
  }
}
