import { FastifyRequest } from 'fastify';
import { TokenLimits, TokenTypes } from '../enums';

export interface AuthorizedRequest extends FastifyRequest {
  auth: {
    type: TokenTypes;
    limits: TokenLimits;
    userId: string;
  };
}
