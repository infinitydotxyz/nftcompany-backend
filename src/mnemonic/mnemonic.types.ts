import { Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator';
import { normalizeAddressTransformer } from 'common/transformers/normalize-address.transformer';

export class MnemonicTopOwner {
  @Transform(normalizeAddressTransformer)
  address: string;

  ownedCount: number;
}

export enum MnemonicTokenType {
  Unspecified = 'TOKEN_TYPE_UNSPECIFIED',
  Unknown = 'TOKEN_TYPE_UNKNOWN',
  Erc20 = 'TOKEN_TYPE_ERC20',
  Erc721 = 'TOKEN_TYPE_ERC721',
  Erc1155 = 'TOKEN_TYPE_ERC1155',
  Erc721Legacy = 'TOKEN_TYPE_ERC721_LEGACY',
  CryptoPunks = 'TOKEN_TYPE_CRYPTOPUNKS'
}

export class TopOwnersResponseBody {
  @IsArray()
  @ValidateNested({ each: true, message: 'Invalid top owner' })
  @Type(() => MnemonicTopOwner)
  owner: MnemonicTopOwner[];
}

export class MnemonicTokenMetadataUri {
  @IsString()
  uri: string;

  @IsString()
  mimeType: string;
}

export class MnemonicTokenMetadata {
  @ValidateNested({ message: 'Invalid metadata uri' })
  @Type(() => MnemonicTokenMetadataUri)
  metadataUri: MnemonicTokenMetadataUri;

  @IsString()
  name: string;

  @IsString()
  description: string;

  @ValidateNested({ message: 'Invalid metadata uri' })
  @Type(() => MnemonicTokenMetadataUri)
  image: MnemonicTokenMetadataUri;
}

export class MnemonicUserNft {
  @Transform(normalizeAddressTransformer)
  contractAddress: string;

  @IsString()
  @IsNotEmpty()
  tokenId: string;

  @IsEnum(MnemonicTokenType)
  type: MnemonicTokenType;

  @IsNumber()
  quantity: number;

  @ValidateNested({ message: 'Token metadata' })
  @Type(() => MnemonicTokenMetadata)
  metadata: MnemonicTokenMetadata;
}
export class UserNftsResponseBody {
  @IsArray()
  @ValidateNested({ each: true, message: 'Invalid user nft' })
  @Type(() => MnemonicTopOwner)
  tokens: MnemonicUserNft[];
}
