import { Controller, Get, Query, Param, UseInterceptors } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation
} from '@nestjs/swagger';
import { ParseCollectionIdPipe, ParsedCollectionId } from 'collections/collection-id.pipe';
import { ApiTag } from 'common/api-tags';
import { ErrorResponseDto } from 'common/dto/error-response.dto';
import { CacheControlInterceptor } from 'common/interceptors/cache-control.interceptor';
import { ResponseDescription } from 'common/response-description';
import { NftActivityQuery } from './dto/nft-activity-query';
import { NftDto } from './dto/nft.dto';
import { NftsService } from './nfts.service';

@Controller('collections/:id/nfts')
export class NftsController {
  constructor(private nftService: NftsService) {}

  @Get(':tokenId')
  @ApiOperation({
    description: 'Get a single nft',
    tags: [ApiTag.Nft]
  })
  @ApiOkResponse({ description: ResponseDescription.Success, type: NftDto })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: ResponseDescription.NotFound, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError, type: ErrorResponseDto })
  @UseInterceptors(new CacheControlInterceptor())
  async getNft(
    @Param('id', ParseCollectionIdPipe) { address, chainId }: ParsedCollectionId,
    @Param('tokenId') tokenId: string
  ) {
    const nft = await this.nftService.getNft({ address, chainId, tokenId });
    return nft;
  }

  @Get('activity')
  @ApiOperation({
    description: 'Get activity for a specific nft'
  })
  async getNftActivity(@Query() query: NftActivityQuery) {
    console.log(query);

    return;
  }
}
