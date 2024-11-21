import { Reflector } from '@nestjs/core';
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

import { AllowedLimits, OptionalAuthorization } from '../decorators';
import { ApiError } from '../errors';
import { Errors } from '../constants';
import { TokenLimits, TokenTypes } from '../enums';
import { isEnumValue } from '../helpers';

@Injectable()
export class AuthorizedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const contextHandler = context.getHandler();
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    const isOptional = this.reflector.get(
      OptionalAuthorization,
      contextHandler,
    );

    const headers = request.headers;

    const tokenType = headers['x-token-type'];
    const tokenLimits = headers['x-token-limits'];
    const userId = headers['x-user'];

    if (!tokenType || !tokenLimits || !userId) {
      if (isOptional) {
        (request as any).auth = null;
        return true;
      }

      throw new ApiError(Errors.JWT_TOKEN_INVALID_OR_MISSING);
    }

    if (
      !isEnumValue(TokenTypes, tokenType) ||
      !isEnumValue(TokenLimits, tokenLimits) ||
      Array.isArray(userId)
    ) {
      throw new ApiError(Errors.JWT_TOKEN_INVALID_OR_MISSING);
    }

    (request as any).auth = {
      type: tokenType as TokenTypes,
      limits: tokenLimits as TokenLimits,
      userId,
    };

    const allowedLimits = this.reflector.get(AllowedLimits, contextHandler);

    if (
      !allowedLimits ||
      (Array.isArray(allowedLimits)
        ? allowedLimits.includes(tokenLimits)
        : allowedLimits === tokenLimits)
    ) {
      return true;
    }

    throw new ApiError(Errors.FORBIDDEN_WITH_TOKEN_LIMITS);
  }
}
