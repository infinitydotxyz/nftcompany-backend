import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ApiSignatureAuth } from 'auth/api-signature.decorator';
import { AuthGuard } from 'auth/auth.guard';
import { ResponseDescription } from 'common/response-description';
import { MatchSigner } from './match-signer.decorator';
import { ApiParamUserId } from './param-user-id.decorator';

/**
 * takes the name of the path parameter containing the user id
 * and applies all auth decorators to ensure the user from the path
 * parameter matches the signature from the header
 */
export function UserAuth(paramName: string) {
  return applyDecorators(
    ApiParamUserId(paramName),
    ApiSignatureAuth(),
    UseGuards(AuthGuard),
    MatchSigner(paramName),
    ApiUnauthorizedResponse({ description: ResponseDescription.Unauthorized })
  );
}
