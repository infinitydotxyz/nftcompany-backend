import { Collection } from '@infinityxyz/lib/types/core';
import { Controller, Get, NotFoundException, Query, UseInterceptors } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation
} from '@nestjs/swagger';
import RankingsRequestDto from 'collections/dto/rankings-query.dto';
import { ApiTag } from 'common/api-tags';
import { ParamCollectionId } from 'common/decorators/param-collection-id.decorator';
import { ErrorResponseDto } from 'common/dto/error-response.dto';
import { CacheControlInterceptor } from 'common/interceptors/cache-control.interceptor';
import { ResponseDescription } from 'common/response-description';
import { CollectionStatsArrayResponseDto } from 'stats/dto/collection-stats-array.dto';
import { StatsService } from 'stats/stats.service';
import { ParseCollectionIdPipe, ParsedCollectionId } from './collection-id.pipe';
import CollectionsService from './collections.service';
import { CollectionSearchArrayDto } from './dto/collection-search-array.dto';
import { CollectionSearchQueryDto } from './dto/collection-search-query.dto';
import { CollectionStatsByPeriod } from './dto/collection-stats-by-period.dto';
import { CollectionStatsQueryDto } from './dto/collection-stats-query.dto';
import { CollectionDto } from './dto/collection.dto';

@Controller('collections')
export class CollectionsController {
  constructor(private collectionsService: CollectionsService, private statsService: StatsService) {}

  @Get('search')
  @ApiOperation({
    description: 'Search for a collection by name',
    tags: [ApiTag.Collection]
  })
  @ApiOkResponse({ description: ResponseDescription.Success, type: CollectionSearchArrayDto })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  async searchByName(@Query() search: CollectionSearchQueryDto) {
    const response = await this.collectionsService.searchByName(search);

    return response;
  }

  @Get('rankings')
  @ApiOperation({
    description: 'Get stats for collections ordered by a given field',
    tags: [ApiTag.Collection, ApiTag.Stats]
  })
  @ApiOkResponse({ description: ResponseDescription.Success, type: CollectionStatsArrayResponseDto })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  @UseInterceptors(new CacheControlInterceptor({ maxAge: 60 * 3 }))
  async getStats(@Query() query: RankingsRequestDto): Promise<CollectionStatsArrayResponseDto> {
    const res = await this.statsService.getCollectionRankings(query);
    return res;
  }

  @Get('/:id')
  @ApiOperation({
    tags: [ApiTag.Collection],
    description: 'Get a single collection by address and chain id or by slug'
  })
  @ApiOkResponse({ description: ResponseDescription.Success, type: CollectionDto })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: ResponseDescription.NotFound, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError, type: ErrorResponseDto })
  @UseInterceptors(new CacheControlInterceptor())
  async getOne(
    @ParamCollectionId('id', ParseCollectionIdPipe) { chainId, address }: ParsedCollectionId
  ): Promise<Collection> {
    const collection = this.collectionsService.getCollectionBySlugOrAddress({ chainId, address });

    if (!collection) {
      throw new NotFoundException();
    }

    return collection;
  }

  @Get('/:id/stats')
  @ApiOperation({
    tags: [ApiTag.Collection],
    description:
      'Get stats for a single collection. Only periods included in the query will be returned in the response'
  })
  @ApiOkResponse({ description: ResponseDescription.Success, type: CollectionStatsByPeriod })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: ResponseDescription.NotFound, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError, type: ErrorResponseDto })
  @UseInterceptors(new CacheControlInterceptor())
  async getCollectionStats(
    @ParamCollectionId('id', ParseCollectionIdPipe) collection: ParsedCollectionId,
    @Query() query: CollectionStatsQueryDto
  ): Promise<any> {
    const response = await this.collectionsService.getCollectionStatsByPeriod(collection, query);

    return response;
  }
}
