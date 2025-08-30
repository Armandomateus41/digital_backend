import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response, Request } from 'express';
import { MulterError } from 'multer';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const status = HttpStatus.PAYLOAD_TOO_LARGE;

    response
      .status(status)
      .json({
        statusCode: status,
        code: 'UPLOAD_TOO_LARGE',
        message: exception.message || 'Uploaded file too large',
        requestId: request.requestId ?? undefined,
      });
  }
}
