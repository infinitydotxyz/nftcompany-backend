import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ApiTag } from 'common/api-tags';
import { AssetService } from './asset.service';
import { AssetQueryDto } from './dto/asset-query.dto';

@Controller('asset')
export class AssetController {
  constructor(private assetService: AssetService) {}

  @Get()
  @ApiOperation({
    description: 'Get a single nft',
    tags: [ApiTag.Nft]
  })
  async getAsset(@Query() assetQuery: AssetQueryDto) {
    if (!(assetQuery.address && assetQuery.chainId) && !assetQuery.slug) {
      throw new BadRequestException('Failed to pass address and chain id or slug');
    }
  }
}
