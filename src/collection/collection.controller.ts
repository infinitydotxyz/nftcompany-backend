import { Collection } from '@infinityxyz/lib/types/core';
import { Body, Controller, Get, NotFoundException } from '@nestjs/common';
import { ParseAddressPipe } from 'common/pipes/parse-address.pipe';
import { ParseChainIdPipe } from 'common/pipes/parse-chain-id.pipe';
import CollectionService from './collection.service';
import { RequestCollectionDto } from './dto/request-collection.dto';

@Controller('collection')
export class CollectionController {
  constructor(private collectionService: CollectionService) {}

  @Get()
  async findOne(
    @Body(new ParseAddressPipe(), new ParseChainIdPipe()) requestCollectionDto: RequestCollectionDto
  ): Promise<Collection> {
    console.log(requestCollectionDto);

    const collection = this.collectionService.getCollection(requestCollectionDto);

    if (!collection) {
      throw new NotFoundException();
    }

    return collection;
  }
}
