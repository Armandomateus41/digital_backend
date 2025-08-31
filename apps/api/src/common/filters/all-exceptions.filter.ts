import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res) {
        const obj = res as Record<string, unknown>;
        const maybeMessage = obj.message;
        const maybeCode = obj.code;
        if (typeof maybeMessage === 'string') message = maybeMessage;
        if (typeof maybeCode === 'string') code = maybeCode;
        else if (status === HttpStatus.UNAUTHORIZED)
          code = 'INVALID_CREDENTIALS';
      }
      if (exception instanceof PayloadTooLargeException) {
        code = 'UPLOAD_TOO_LARGE';
      }
    } else if (exception && typeof exception === 'object') {
      const err = exception as Record<string, unknown>;
      const maybeMessage = err.message;
      const maybeCode = err.code;
      if (typeof maybeMessage === 'string') message = maybeMessage;
      if (typeof maybeCode === 'string') code = maybeCode;
    }

    const stack =
      typeof (exception as { stack?: unknown })?.stack === 'string'
        ? (exception as { stack?: string }).stack
        : undefined;
    this.logger.error(
      { status, code, message, requestId: request.requestId },
      stack,
    );

    response
      .status(status)
      .header('Content-Type', 'application/problem+json')
      .json({
        type: `https://httpstatuses.com/${status}`,
        title: HttpStatus[status] ?? 'Error',
        status,
        code,
        detail: message,
        instance: request.url,
        requestId: request.requestId ?? undefined,
      });
  }
}
