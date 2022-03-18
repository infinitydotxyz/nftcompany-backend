import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Response } from 'express';
import { map } from 'rxjs/operators';

/**
 * interceptor that handles strignifying data and setting the cache-control
 */
@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private maxAge = 60) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const ctx = context.switchToHttp();
    const res = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        if (typeof data === 'object' && data) {
          const respStr = JSON.stringify(data, null, 2);
          res.set({
            'Cache-Control': `must-revalidate, max-age=${this.maxAge}`,
            'Content-Length': Buffer.byteLength(respStr, 'utf8')
          });
          return data;
        }
        return data;
      })
    );
  }
}
