import { ApiSecurity } from '@nestjs/swagger';

export function ApiSignatureAuth(name = 'signature') {
  return ApiSecurity(name);
}
