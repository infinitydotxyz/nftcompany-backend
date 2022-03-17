import { Collection } from '@infinityxyz/lib/types/core';
import { getCollectionDocId } from '@infinityxyz/lib/utils';
import { Body, Controller, Get } from '@nestjs/common';
import { ParseAddressPipe } from 'common/pipes/parse-address.pipe';
import { ParseChainIdPipe } from 'common/pipes/parse-chain-id.pipe';
import { firestore } from 'container';
import { RequestCollectionDto } from './dto/request-collection.dto';

@Controller('collection')
export class CollectionController {
  @Get()
  async findOne(
    @Body(new ParseAddressPipe(), new ParseChainIdPipe()) requestCollectionDto: RequestCollectionDto
  ): Promise<Collection> {
    console.log(requestCollectionDto);

    const collectionSnapShot = await firestore.db
      .collection('collections')
      .doc(
        getCollectionDocId({ collectionAddress: requestCollectionDto.address, chainId: requestCollectionDto.chainId })
      )
      .get();

    const collection = collectionSnapShot.data() as Collection;

    return collection;
  }
}
