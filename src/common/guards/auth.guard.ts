import { trimLowerCase } from '@infinityxyz/lib/utils';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ethers } from 'ethers';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const message = request.headers['x-auth-message'];
    let signature;
    if (request.headers['x-auth-signature']) {
      try {
        signature = JSON.parse(request.headers['x-auth-signature']);
      } catch (err) {}
    }

    const signingAddress = trimLowerCase(ethers.utils.verifyMessage(message, signature));

    const userAddress = trimLowerCase(request.query.userAddress);

    return userAddress === signingAddress;
  }
}
