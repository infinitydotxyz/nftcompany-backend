import { ChainId, Collection } from '@infinityxyz/lib/types/core';
import { BadRequestException, Controller, Get, NotFoundException, Query, UseInterceptors } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse
} from '@nestjs/swagger';
import { CacheControlInterceptor } from 'common/interceptors/cache-control.interceptor';
import { NormalizeAddressPipe } from 'common/pipes/normalize-address.pipe';
import { ResponseDescription } from 'common/response-description';
import StatsRequestDto from 'stats/dto/stats-request.dto';
import { StatsService } from 'stats/stats.service';
import CollectionService from './collection.service';
import { CollectionResponseDto } from './dto/collection-response.dto';
import { RequestCollectionDto } from './dto/request-collection.dto';

@Controller('collection')
export class CollectionController {
  constructor(private collectionService: CollectionService, private statsService: StatsService) {}

  @Get()
  @ApiOkResponse({ description: ResponseDescription.Success, type: CollectionResponseDto })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest })
  @ApiNotFoundResponse({ description: ResponseDescription.NotFound })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  @UseInterceptors(new CacheControlInterceptor())
  async getOne(@Query(new NormalizeAddressPipe()) query: RequestCollectionDto): Promise<Collection> {
    let collection: Collection | undefined;
    if (query.slug) {
      collection = await this.getOneBySlug({ slug: query.slug, chainId: query.chainId });
    } else if (query.address) {
      collection = await this.getOneByAddress({ address: query.address, chainId: query.chainId });
    } else {
      throw new BadRequestException({}, 'Failed to pass address or slug');
    }

    if (!collection) {
      throw new NotFoundException();
    }

    return collection;
  }

  @Get('/stats')
  @ApiOkResponse({ description: ResponseDescription.Success, type: CollectionResponseDto })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest })
  @UseInterceptors(new CacheControlInterceptor({ maxAge: 60 * 3 }))
  async getStats(@Query() query: StatsRequestDto): Promise<any> {
    const res = await this.statsService.getStats(query);
    return res;
  }

  /**
   * Get a single collection by address
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
   * Get a single collection by slug
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
