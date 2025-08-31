import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { createHash } from 'crypto';
import { Observable, map } from 'rxjs';

@Injectable()
export class EtagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const res = ctx.getResponse<Response>();
    return next.handle().pipe(
      map((body: unknown) => {
        try {
          const json = JSON.stringify(body);
          const hash = createHash('sha1').update(json).digest('hex');
          res.setHeader('ETag', `W/"${hash}"`);
        } catch {
          // ignore
        }
        return body;
      }),
    );
  }
}
