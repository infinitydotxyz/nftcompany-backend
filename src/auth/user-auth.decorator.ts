import { applyDecorators } from '@nestjs/common/decorators/core/apply-decorators';
import { UseGuards } from '@nestjs/common/decorators/core/use-guards.decorator';
import { ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ApiSignatureAuth } from 'auth/api-signature.decorator';
import { AuthGuard } from 'auth/auth.guard';
import { ResponseDescription } from 'common/response-description';
import { MatchSigner } from './match-signer.decorator';
import { ApiParamUserId } from './param-user-id.decorator';

export function UserAuth(userIdPathParam: string) {
  return applyDecorators(
    ApiSignatureAuth(),
    ApiParamUserId(userIdPathParam),
    ApiUnauthorizedResponse({ description: ResponseDescription.Unauthorized }),
    UseGuards(AuthGuard),
    MatchSigner(userIdPathParam)
  );
}
