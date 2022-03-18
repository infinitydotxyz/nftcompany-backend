import { ChainId, Collection } from '@infinityxyz/lib/types/core';
import {
  BadRequestException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Query,
  UseInterceptors
} from '@nestjs/common';
import { ApiInternalServerErrorResponse, ApiNotFoundResponse, ApiOkResponse } from '@nestjs/swagger';
import { CacheControlInterceptor } from 'common/interceptors/cache-control.interceptor';
import { NormalizeAddressPipe } from 'common/pipes/normalize-address.pipe';
import CollectionService from './collection.service';
import { CollectionResponseDto } from './dto/collection-response.dto';
import { RequestCollectionByAddressDto } from './dto/request-collection-by-address.dto';

@Controller('collection')
export class CollectionController {
  constructor(private collectionService: CollectionService) {}

  @Get()
  @ApiOkResponse({ description: 'Success', type: CollectionResponseDto })
  @ApiNotFoundResponse({ description: 'Collection not found' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  @UseInterceptors(new CacheControlInterceptor())
  async getOne(@Query(new NormalizeAddressPipe()) query: RequestCollectionByAddressDto): Promise<Collection> {
    let collection: Collection | undefined;
    if ('slug' in query && query.slug) {
      collection = await this.getOneBySlug({ slug: query.slug, chainId: query.chainId });
    } else if ('address' in query && query.address) {
      collection = await this.getOneByAddress({ address: query.address, chainId: query.chainId });
    } else {
      throw new BadRequestException({}, 'Failed to pass address or slug');
    }

    if (!collection) {
      throw new NotFoundException();
    }

    return collection;
  }

  /**
   * get a single collection by address
   */
  private async getOneByAddress({ address, chainId }: { address: string; chainId: ChainId }): Promise<Collection> {
    const collection = await this.collectionService.getCollectionByAddress({
      address,
      chainId
    });

    if (!collection) {
      throw new NotFoundException();
    }

    return collection;
  }

  /**
   * get a single collection by slug
   */
  private async getOneBySlug({ slug, chainId }: { slug: string; chainId: ChainId }): Promise<Collection> {
    const collection = await this.collectionService.getCollectionBySlug({
      slug,
      chainId
    });

    if (!collection) {
      throw new NotFoundException();
    }

    return collection;
  }
}
