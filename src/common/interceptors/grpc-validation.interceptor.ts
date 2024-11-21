import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class GrpcValidationInterceptor implements NestInterceptor {
  constructor(private requiredFields: string[]) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const call = context.switchToRpc().getData();

    const notPresentFields: string[] = [];
    for (const field of this.requiredFields) {
      if (call[field] === undefined || call[field] === null) {
        notPresentFields.push(field);
      }
    }

    if (notPresentFields.length) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: `Validation failed: ${notPresentFields.map((v) => `"${v}"`).join(', ')} field${notPresentFields.length > 1 ? 's' : ''} must be present`,
      });
    }

    return next.handle();
  }
}
