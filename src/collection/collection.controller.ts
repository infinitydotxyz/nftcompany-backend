import { Collection } from '@infinityxyz/lib/types/core';
import { BadRequestException, Controller, Get, NotFoundException, Query, UseInterceptors } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation
} from '@nestjs/swagger';
import { ApiTag } from 'common/api-tags';
import { ErrorResponseDto } from 'common/dto/error-response.dto';
import { CacheControlInterceptor } from 'common/interceptors/cache-control.interceptor';
import { ResponseDescription } from 'common/response-description';
// Import { ObjectResponse } from 'common/responses/object-response';
import { CollectionViaAddressDto, CollectionViaSlugDto } from 'firebase/dto/collection-ref.dto';
import { StatsService } from 'stats/stats.service';
import CollectionService from './collection.service';
import { CollectionResponseDto } from './dto/collection-response.dto';
import { RequestCollectionDto } from './dto/request-collection.dto';

@Controller('collection')
export class CollectionController {
  constructor(private collectionService: CollectionService, private statsService: StatsService) {}

  @Get()
  @ApiOperation({
    tags: [ApiTag.Collection],
    description: 'Get a single collection by address and chain id or by slug'
  })
  @ApiOkResponse({ description: ResponseDescription.Success, type: CollectionResponseDto })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: ResponseDescription.NotFound, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError, type: ErrorResponseDto })
  @UseInterceptors(new CacheControlInterceptor())
  async getOne(@Query() query: RequestCollectionDto): Promise<Collection> {
    let collection: Collection | undefined;
    if ('slug' in query) {
      collection = await this.getOneBySlug({ slug: query.slug });
    } else if ('address' in query) {
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
   * Get a single collection by address
   */
  private async getOneByAddress({ address, chainId }: CollectionViaAddressDto): Promise<Collection> {
    console.log(address);
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
   * Get a single collection by slug
   */
  private async getOneBySlug({ slug }: CollectionViaSlugDto): Promise<Collection> {
    const collection = await this.collectionService.getCollectionBySlug({
      slug
    });

    if (!collection) {
      throw new NotFoundException();
    }

    return collection;
  }
}
