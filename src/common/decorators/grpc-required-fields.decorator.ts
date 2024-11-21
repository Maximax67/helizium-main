import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { GrpcValidationInterceptor } from '../interceptors';

export function GrpcRequiredFields(requiredFields: string[]) {
  return applyDecorators(
    UseInterceptors(new GrpcValidationInterceptor(requiredFields)),
  );
}
