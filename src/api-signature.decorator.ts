import { applyDecorators } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { auth } from './constants';

export function ApiSignatureAuth() {
  return applyDecorators(ApiSecurity(auth.signature), ApiSecurity(auth.message));
}
