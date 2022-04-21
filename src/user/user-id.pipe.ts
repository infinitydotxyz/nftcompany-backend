import { ChainId } from '@infinityxyz/lib/types/core';
import { PipeTransform, Injectable } from '@nestjs/common';
import { UserProfileDto } from './dto/user-profile.dto';
import { UserService } from './user.service';

export type ParsedUserId = {
  userAddress: string;
  userChainId: ChainId;
  ref: FirebaseFirestore.DocumentReference<UserProfileDto>;
};

@Injectable()
export class ParseUserIdPipe implements PipeTransform<string, Promise<ParsedUserId>> {
  constructor(private userService: UserService) {}

  async transform(value: string): Promise<ParsedUserId> {
    return await this.userService.parse(value);
  }
}
