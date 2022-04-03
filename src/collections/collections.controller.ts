import { Collection } from '@infinityxyz/lib/types/core';
import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query, UseInterceptors } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation
} from '@nestjs/swagger';
import RankingsRequestDto from 'collections/dto/rankings-query.dto';
import { ApiTag } from 'common/api-tags';
import { ApiParamCollectionId, ParamCollectionId } from 'common/decorators/param-collection-id.decorator';
import { ErrorResponseDto } from 'common/dto/error-response.dto';
import { PaginatedQuery } from 'common/dto/paginated-query.dto';
import { CacheControlInterceptor } from 'common/interceptors/cache-control.interceptor';
import { ResponseDescription } from 'common/response-description';
import { CollectionStatsArrayResponseDto } from 'stats/dto/collection-stats-array.dto';
import { StatsService } from 'stats/stats.service';
import { TweetArrayDto } from 'twitter/dto/tweet-array.dto';
import { TwitterService } from 'twitter/twitter.service';
import { CollectionVotesDto } from 'votes/dto/collection-votes.dto';
import { VotesService } from 'votes/votes.service';
import { ParseCollectionIdPipe, ParsedCollectionId } from './collection-id.pipe';
import CollectionsService from './collections.service';
import { CollectionHistoricalStatsQueryDto } from './dto/collection-historical-stats-query.dto';
import { CollectionSearchArrayDto } from './dto/collection-search-array.dto';
import { CollectionSearchQueryDto } from './dto/collection-search-query.dto';
import { CollectionStatsByPeriodDto } from './dto/collection-stats-by-period.dto';
import { CollectionStatsQueryDto } from './dto/collection-stats-query.dto';
import { CollectionDto } from './dto/collection.dto';

@Controller('collections')
export class CollectionsController {
  constructor(
    private collectionsService: CollectionsService,
    private statsService: StatsService,
    private votesService: VotesService,
    private twitterService: TwitterService
  ) {}

  @Get('search')
  @ApiOperation({
    description: 'Search for a collection by name',
    tags: [ApiTag.Collection]
  })
  @ApiOkResponse({ description: ResponseDescription.Success, type: CollectionSearchArrayDto })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  async searchByName(@Query() search: CollectionSearchQueryDto) {
    const res = await this.collectionsService.searchByName(search);
    return res;
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
  @ApiParamCollectionId()
  @ApiOkResponse({ description: ResponseDescription.Success, type: CollectionDto })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: ResponseDescription.NotFound, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError, type: ErrorResponseDto })
  @UseInterceptors(new CacheControlInterceptor())
  async getOne(
    @ParamCollectionId('id', ParseCollectionIdPipe) { chainId, address }: ParsedCollectionId
  ): Promise<Collection> {
    const collection = await this.collectionsService.getCollectionByAddress({ chainId, address });

    if (!collection) {
      throw new NotFoundException();
    }

    return collection;
  }

  @Get('/:id/stats')
  @ApiOperation({
    tags: [ApiTag.Collection, ApiTag.Stats],
    description: 'Get historical stats for a single collection'
  })
  @ApiParamCollectionId()
  @ApiOkResponse({ description: ResponseDescription.Success, type: CollectionStatsArrayResponseDto })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: ResponseDescription.NotFound, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError, type: ErrorResponseDto })
  @UseInterceptors(new CacheControlInterceptor())
  async getCollectionHistoricalStats(
    @ParamCollectionId('id', ParseCollectionIdPipe) collection: ParsedCollectionId,
    @Query() query: CollectionHistoricalStatsQueryDto
  ): Promise<CollectionStatsArrayResponseDto> {
    const response = await this.statsService.getCollectionHistoricalStats(collection, query);

    return response;
  }

  @Get('/:id/stats/:date')
  @ApiOperation({
    tags: [ApiTag.Collection, ApiTag.Stats],
    description: 'Get stats for a single collection, at a specific date, for all periods passed in the query'
  })
  @ApiParamCollectionId()
  @ApiOkResponse({ description: ResponseDescription.Success, type: CollectionStatsByPeriodDto })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: ResponseDescription.NotFound, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError, type: ErrorResponseDto })
  @UseInterceptors(new CacheControlInterceptor())
  async getStatsByDate(
    @ParamCollectionId('id', ParseCollectionIdPipe) collection: ParsedCollectionId,
    @Param('date', ParseIntPipe) date: number,
    @Query() query: CollectionStatsQueryDto
  ): Promise<CollectionStatsByPeriodDto> {
    const response = await this.statsService.getCollectionStatsByPeriodAndDate(collection, date, query.periods);

    return response;
  }

  @Get('/:id/votes')
  @ApiOperation({
    tags: [ApiTag.Collection, ApiTag.Votes],
    description: 'Get votes for a single collection'
  })
  @ApiParamCollectionId()
  @ApiOkResponse({ description: ResponseDescription.Success, type: CollectionVotesDto })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: ResponseDescription.NotFound, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError, type: ErrorResponseDto })
  @UseInterceptors(new CacheControlInterceptor())
  async getCollectionVotes(
    @ParamCollectionId('id', ParseCollectionIdPipe) collection: ParsedCollectionId
  ): Promise<CollectionVotesDto> {
    const response = await this.votesService.getCollectionVotes(collection);

    return response;
  }

  @Get('/:id/mentions')
  @ApiOperation({
    tags: [ApiTag.Collection],
    description: 'Get twitter mentions for a single collection ordered by author followers'
  })
  @ApiParamCollectionId()
  @ApiOkResponse({ description: ResponseDescription.Success, type: TweetArrayDto })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError, type: ErrorResponseDto })
  @UseInterceptors(new CacheControlInterceptor())
  async getCollectionTwitterMentions(
    @ParamCollectionId('id', ParseCollectionIdPipe) collection: ParsedCollectionId,
    @Query() query: PaginatedQuery
  ): Promise<TweetArrayDto> {
    const response = await this.twitterService.getCollectionTopMentions(collection.ref, query);

    return response;
  }
}
