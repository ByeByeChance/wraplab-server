import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { StoreContext } from '../context/store-context';
import { JwtPayload } from '../decorators/current-user.decorator';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;

    if (user) {
      return new Observable((subscriber) => {
        StoreContext.run(
          {
            storeId: user.store_id,
            staffId: user.sub,
            role: user.role,
            requestId: request.requestId ?? '',
          },
          () => {
            next.handle().subscribe({
              next: (val) => subscriber.next(val),
              error: (err) => subscriber.error(err),
              complete: () => subscriber.complete(),
            });
          },
        );
      });
    }

    // Public endpoints: skip StoreContext initialization
    return next.handle();
  }
}
