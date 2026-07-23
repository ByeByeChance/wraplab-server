import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

const SLOW_REQUEST_THRESHOLD_MS = 500;

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, originalUrl } = request;
    const requestId = uuidv4();

    request.requestId = requestId;

    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const { statusCode } = response;
          const elapsed = Date.now() - now;
          const msg = `${method} ${originalUrl} ${statusCode} ${elapsed}ms [${requestId}]`;
          if (elapsed > SLOW_REQUEST_THRESHOLD_MS) {
            this.logger.warn(`SLOW ${msg}`);
          } else {
            this.logger.log(msg);
          }
        },
        error: (error: unknown) => {
          const elapsed = Date.now() - now;
          const err = error as { status?: number; message?: string };
          this.logger.warn(
            `${method} ${originalUrl} ${err.status || 500} ${elapsed}ms [${requestId}] — ${err.message || 'Unknown error'}`,
          );
        },
      }),
    );
  }
}
