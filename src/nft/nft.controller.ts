import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  IntersectionType
} from '@nestjs/swagger';
import { ApiTag } from 'common/api-tags';
import { ErrorResponseDto } from 'common/dto/error-response.dto';
import { CacheControlInterceptor } from 'common/interceptors/cache-control.interceptor';
import { ResponseDescription } from 'common/response-description';
import { NftQueryDto } from './dto/nft-query.dto';
import { NftDto } from './dto/nft.dto';
import { NftService } from './nft.service';

@Controller('nft')
export class NftController {
  constructor(private nftService: NftService) {}

  @Get()
  @ApiOperation({
    description: 'Get a single nft',
    tags: [ApiTag.Nft]
  })
  @ApiOkResponse({ description: ResponseDescription.Success, type: NftDto })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: ResponseDescription.NotFound, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError, type: ErrorResponseDto })
  @UseInterceptors(new CacheControlInterceptor())
  async getNft(@Query() nftQuery: NftQueryDto) {
    const nft = await this.nftService.getNft(nftQuery);
    return nft;
  }
}
