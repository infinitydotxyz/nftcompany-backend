import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';

export const ParamTokenId = createParamDecorator(
  (paramKey: string, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest();
    const param = request.params[paramKey];
    return param;
  },
  [
    (target: any, key: string) => {
      ApiParam({
        name: 'tokenId',
        description: 'The token id of the nft',
        required: true,
        example: '8880',
        schema: { type: 'string' }
      })(target, key, Object.getOwnPropertyDescriptor(target, key));
    }
  ]
);
