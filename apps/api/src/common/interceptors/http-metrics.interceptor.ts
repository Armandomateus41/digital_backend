import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { MetricsService } from '../../metrics/metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const method =
      typeof req?.method === 'string' ? req.method.toUpperCase() : 'GET';
    const route =
      typeof (req as { route?: { path?: string } })?.route?.path === 'string'
        ? (req as { route?: { path?: string } }).route!.path!
        : typeof (req as { path?: string }).path === 'string'
          ? (req as { path?: string }).path!
          : 'unknown';

    const endTimer = this.metrics.httpRequestDuration.startTimer({
      method,
      route,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const statusCode =
            typeof (res as { statusCode?: number }).statusCode === 'number'
              ? (res as { statusCode: number }).statusCode
              : 200;
          const resStatus = String(statusCode);
          endTimer({ status_code: resStatus });
          this.metrics.httpRequestsTotal
            .labels({ method, route, status_code: resStatus })
            .inc();
          // Contador de erros 5xx
          if (statusCode >= 500) {
            this.metrics.httpRequestsErrorsTotal
              .labels({ method, route, status_code: resStatus })
              .inc();
          }
        },
        error: () => {
          const statusCode =
            typeof (res as { statusCode?: number }).statusCode === 'number'
              ? (res as { statusCode: number }).statusCode
              : 500;
          const resStatus = String(statusCode);
          endTimer({ status_code: resStatus });
          this.metrics.httpRequestsTotal
            .labels({ method, route, status_code: resStatus })
            .inc();
          if (statusCode >= 500) {
            this.metrics.httpRequestsErrorsTotal
              .labels({ method, route, status_code: resStatus })
              .inc();
          }
        },
      }),
    );
  }
}
