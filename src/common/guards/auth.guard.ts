import { trimLowerCase } from '@infinityxyz/lib/utils';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { auth } from '../../constants';
import { ethers } from 'ethers';
import { Reflector } from '@nestjs/core';
import { toLower } from 'lodash';
import { metadataKey } from 'common/decorators/match-signer.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
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

      let address = paramValue;

      // Chain:address
      if (paramValue.includes(':')) {
        const split = paramValue.split(':');
        address = toLower(split[1]);
      }

      // Address
      return address === signingAddress;
    } catch (err: any) {
      return false;
    }
  }
}
