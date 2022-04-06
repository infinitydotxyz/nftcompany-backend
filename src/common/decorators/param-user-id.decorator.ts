import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';

export const ParamUserId = createParamDecorator(
  (paramKey: string, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest();
    const param = request.params[paramKey];
    return param;
  },
  [
    (target: any, key: string) => {
      ApiParam({
        name: 'id',
        description: 'The id of the user',
        required: true,
        examples: {
          address: {
            summary: 'Via chain id and address',
            description: 'Identify a user their wallet chain id and address. Format <chainId:address>',
            value: '1:0xd8da6bf26964af9d7eed9e03e53415d37aa96045'
          }
        },
        schema: { type: 'string' }
      })(target, key, Object.getOwnPropertyDescriptor(target, key));
    }
  ]
);
