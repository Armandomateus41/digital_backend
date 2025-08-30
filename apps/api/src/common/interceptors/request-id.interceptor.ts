import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest<{
      headers: Record<string, unknown>;
      requestId?: string;
    }>();
    const response = http.getResponse<{
      setHeader: (name: string, value: string) => void;
    }>();

    const rawHeader = request.headers['x-request-id'];
    const incomingId: string | undefined =
      typeof rawHeader === 'string' ? rawHeader : undefined;
    const requestId =
      incomingId &&
      typeof incomingId === 'string' &&
      incomingId.trim().length > 0
        ? incomingId
        : randomUUID();

    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    return next.handle();
  }
}
