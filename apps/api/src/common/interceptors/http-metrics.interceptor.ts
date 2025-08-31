import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { MetricsService } from '../../metrics/metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request & { route?: { path?: string } }>();
    const method = req.method?.toUpperCase?.() ?? 'GET';
    const route = req.route?.path ?? req.path ?? 'unknown';
    const endTimer = this.metrics.httpRequestDuration.startTimer({ method, route });

    return next.handle().pipe(
      tap({
        next: () => {
          const resStatus = String((ctx.getResponse()?.statusCode as number) ?? 200);
          endTimer({ status_code: resStatus });
          this.metrics.httpRequestsTotal.labels({ method, route, status_code: resStatus }).inc();
        },
        error: () => {
          const resStatus = String((ctx.getResponse()?.statusCode as number) ?? 500);
          endTimer({ status_code: resStatus });
          this.metrics.httpRequestsTotal.labels({ method, route, status_code: resStatus }).inc();
        },
      }),
    );
  }
}


