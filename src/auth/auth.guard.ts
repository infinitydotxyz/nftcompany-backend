import { trimLowerCase } from '@infinityxyz/lib/utils';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { auth } from '../constants';
import { ethers } from 'ethers';
import { Reflector } from '@nestjs/core';
import { metadataKey } from 'auth/match-signer.decorator';
import { UserParserService } from 'user/parser/user-parser.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector, private userParserService: UserParserService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const paramName = this.reflector.get<string>(metadataKey, context.getHandler());
    const messageHeader = request.headers?.[auth.message];
    const signatureHeader = request.headers?.[auth.signature];

    if (!messageHeader || !signatureHeader) {
      return false;
    }

    try {
      const signingAddress = trimLowerCase(ethers.utils.verifyMessage(messageHeader, JSON.parse(signatureHeader)));

      if (!signingAddress) {
        return false;
      }

      const paramValue = request.params[paramName];
      const user = await this.userParserService.parse(paramValue);

      return user.userAddress === signingAddress;
    } catch (err: any) {
      return false;
    }
  }
}
