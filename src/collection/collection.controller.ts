import { Collection } from '@infinityxyz/lib/types/core';
import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import CollectionService from './collection.service';
import { RequestCollectionDto } from './dto/request-collection.dto';

@Controller('collection')
export class CollectionController {
  constructor(private collectionService: CollectionService) {}

  @Get()
  async getOne(@Query() { address, chainId }: RequestCollectionDto): Promise<Collection> {
    const collection = await this.collectionService.getCollection({
      address,
      chainId
    });

    if (!collection) {
      throw new NotFoundException();
    }

    return collection;
  }
}
