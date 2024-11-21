import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthorizedRequest } from '../interfaces';

export const CurrentUserId = createParamDecorator(
  (_data: never, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    const auth = request.auth;

    return auth ? auth.userId : null;
  },
);
