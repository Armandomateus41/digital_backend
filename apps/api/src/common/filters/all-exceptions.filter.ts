import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger, PayloadTooLargeException } from '@nestjs/common';
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
        const anyRes = res as Record<string, any>;
        message = anyRes.message ?? message;
        code = anyRes.code ?? (status === 401 ? 'INVALID_CREDENTIALS' : code);
      }
      if (exception instanceof PayloadTooLargeException) {
        code = 'UPLOAD_TOO_LARGE';
      }
    } else if (exception && typeof exception === 'object') {
      const err = exception as any;
      message = err.message || message;
      code = err.code || code;
    }

    this.logger.error({ status, code, message, requestId: request.requestId }, (exception as any)?.stack);

    response.status(status).json({
      statusCode: status,
      code,
      message,
      requestId: request.requestId ?? undefined,
    });
  }
}
