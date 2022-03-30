import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';

export const ParamCollectionId = createParamDecorator(
  (paramKey: string, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest();
    const param = request.params[paramKey];
    return param;
  },
  [
    (target: any, key: string) => {
      ApiParam({
        name: 'Collection Id',
        description: 'The id of the collection',
        required: true,
        examples: {
          address: {
            summary: 'Via chain id and address',
            description:
              'Identify a collection by the chain id and address of the collection. Format <chainId:address>',
            value: '1:0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d'
          },
          slug: {
            summary: 'Via slug',
            description: 'Identify the collection using the slug',
            value: 'boredapeyachtclub'
          }
        },
        schema: { type: 'string' }
      })(target, key, Object.getOwnPropertyDescriptor(target, key));
    }
  ]
);
