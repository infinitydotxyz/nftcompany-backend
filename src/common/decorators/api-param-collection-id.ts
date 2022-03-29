import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';

export const ApiParamCollectionId = createParamDecorator(
  (data: string, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest();
    const param = request.params[data];
    return param;
  },
  [
    (target: any, key: string) => {
      ApiParam({
        name: 'id',
        description: 'The id of the collection',
        required: true,
        examples: {
          slug: {
            summary: 'Via slug',
            description: 'By the slug of the collection',
            value: 'boredapeyachtclub'
          },
          address: {
            summary: 'Via chain id and address',
            description: 'By chain id and address of the collection',
            value: '1:0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d'
          }
        },
        schema: { type: 'string' }
      })(target, key, Object.getOwnPropertyDescriptor(target, key));
    }
  ]
);
