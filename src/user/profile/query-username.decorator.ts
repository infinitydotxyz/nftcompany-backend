import { trimLowerCase } from '@infinityxyz/lib/utils/formatters';
import { createParamDecorator } from '@nestjs/common/decorators/http/create-route-param-metadata.decorator';
import { ExecutionContext } from '@nestjs/common/interfaces/features/execution-context.interface';
import { Request } from 'express';
import { usernameConstraints } from './profile.constants';
import { ProfileService } from './profile.service';
import { UsernameType } from './profile.types';

export const QueryUsername = createParamDecorator((data: string, ctx: ExecutionContext): UsernameType => {
  const request: Request = ctx.switchToHttp().getRequest();
  const username = request.query[data] as string;

  const normalizedUsername = trimLowerCase(username);
  const isValid = ProfileService.isValidUsername(normalizedUsername);

  if (isValid) {
    return {
      isValid,
      username: normalizedUsername
    };
  }

  return { isValid, username: normalizedUsername, reason: `Invalid username. ${usernameConstraints}` };
});
