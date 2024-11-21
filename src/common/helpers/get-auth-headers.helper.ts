import { TokenLimits, TokenTypes } from '../enums';

export const getAuthHeaders = (
  userId: string,
  tokenType: TokenTypes,
  tokenLimits: TokenLimits,
) => ({
  'x-user': userId,
  'x-token-type': tokenType,
  'x-token-limits': tokenLimits,
});
