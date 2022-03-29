import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiTag } from 'common/api-tags';
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
  async getNft(@Query() nftQuery: NftQueryDto) {
    const res = await this.nftService.getNft(nftQuery);

    return res;
  }
}
