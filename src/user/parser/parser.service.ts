import { ChainId } from '@infinityxyz/lib/types/core';
import { trimLowerCase } from '@infinityxyz/lib/utils';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ethers } from 'ethers';
import { UserProfileDto } from 'user/dto/user-profile.dto';
import { UserService } from 'user/user.service';
import { ParsedUserId } from './parsed-user-id';

@Injectable()
export class UserParserService {
  constructor(private userService: UserService) {}

  /**
   * Parse and validates the provided value into a {@link ParsedUserId}.
   * Note that this method throws Nest HTTP errors (e.g. `BadRequestException`) as part of the validation process.
   */
  async parse(value: string): Promise<ParsedUserId> {
    const usernameOrAddress = trimLowerCase(value);

    // username
    if (!usernameOrAddress.includes(':') && !ethers.utils.isAddress(usernameOrAddress)) {
      const { user, ref } = await this.userService.getByUsername(usernameOrAddress);
      if (!user) {
        throw new NotFoundException('Failed to find user via username');
      }
      const userChainId = ChainId.Mainnet;
      const userAddress = user.address;
      return {
        userAddress,
        userChainId,
        ref
      };
    }

    // address
    if (ethers.utils.isAddress(usernameOrAddress)) {
      return {
        userAddress: usernameOrAddress,
        userChainId: ChainId.Mainnet,
        ref: this.userService.getRef(usernameOrAddress) as FirebaseFirestore.DocumentReference<UserProfileDto>
      };
    }

    // chain:address
    const [chainId, address] = value.split(':').map((item) => trimLowerCase(item));

    if (!Object.values(ChainId).includes(chainId as any)) {
      throw new BadRequestException('Invalid chain id');
    }

    if (!ethers.utils.isAddress(address)) {
      throw new BadRequestException('Invalid address');
    }

    return {
      userAddress: address,
      userChainId: chainId as ChainId,
      ref: this.userService.getRef(address) as FirebaseFirestore.DocumentReference<UserProfileDto>
    };
  }
}
