import { Transform, Type } from 'class-transformer';
import { normalizeAddressTransformer } from 'common/transformers/normalize-address.transformer';

export class MnemonicTopOwner {
  @Transform(normalizeAddressTransformer)
  address: string;

  ownedCount: number;
}

export class TopOwnersResponseBody {
  @Type(() => MnemonicTopOwner)
  owner: MnemonicTopOwner[];
}
