import { trimLowerCase } from '@infinityxyz/lib/utils';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { auth } from '../../constants';
import { ethers } from 'ethers';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const message = request.headers?.[auth.message];
    let signature;
    let userAddress, signingAddress;
    if (request.headers?.[auth.signature]) {
      try {
        signature = JSON.parse(request.headers[auth.signature]);
        signingAddress = trimLowerCase(ethers.utils.verifyMessage(message, signature));
        const [, address] = request.params.userId.split(':').map((item) => trimLowerCase(item));
        userAddress = address;
      } catch (err) {
        return false;
      }
    }

    return userAddress && signingAddress && userAddress === signingAddress;
  }
}
