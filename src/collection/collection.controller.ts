import { Collection } from '@infinityxyz/lib/types/core';
import { Controller, Get, NotFoundException, Query, UseInterceptors } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation
} from '@nestjs/swagger';
import RankingsRequestDto from 'collection/dto/rankings-query.dto';
import { ApiTag } from 'common/api-tags';
import { ErrorResponseDto } from 'common/dto/error-response.dto';
import { CacheControlInterceptor } from 'common/interceptors/cache-control.interceptor';
import { ResponseDescription } from 'common/response-description';
import { CollectionStatsArrayResponseDto } from 'stats/dto/collection-stats-array.dto';
import { StatsService } from 'stats/stats.service';
import CollectionService from './collection.service';
import { CollectionQueryDto } from './dto/collection-query.dto';
import { CollectionDto } from './dto/collection.dto';

@Controller('collection')
export class CollectionController {
  constructor(private collectionService: CollectionService, private statsService: StatsService) {}

  @Get()
  @ApiOperation({
    tags: [ApiTag.Collection],
    description: 'Get a single collection by address and chain id or by slug'
  })
  @ApiOkResponse({ description: ResponseDescription.Success, type: CollectionDto })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: ResponseDescription.NotFound, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError, type: ErrorResponseDto })
  @UseInterceptors(new CacheControlInterceptor())
  async getOne(@Query() query: CollectionQueryDto): Promise<Collection> {
    const collection = this.collectionService.getCollectionBySlugOrAddress(query);

    if (!collection) {
      throw new NotFoundException();
    }

    return collection;
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
}
