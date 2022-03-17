import { IsString, IsEthereumAddress } from 'class-validator';

export class RequestCollectionDto {
  @IsEthereumAddress()
  readonly address: string;

  @IsString()
  readonly chainId: string;
}
