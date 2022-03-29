import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from 'common/guards/auth.guard';
import { UserDto } from './dto/user.dto';
import { UserService } from './user.service';
import { ApiInternalServerErrorResponse, ApiOkResponse, ApiOperation, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ApiTag } from 'common/api-tags';
import { ResponseDescription } from 'common/response-description';
import { CollectionStatsArrayResponseDto } from 'stats/dto/collection-stats-array.dto';
import RankingsRequestDto from 'collections/dto/rankings-query.dto';
import { ApiSignatureAuth } from 'api-signature.decorator';
import { CacheControlInterceptor } from 'common/interceptors/cache-control.interceptor';

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('watchlist')
  @ApiOperation({
    description: "Get a user's watchlist",
    tags: [ApiTag.User, ApiTag.Stats]
  })
  @ApiSignatureAuth()
  @UseGuards(new AuthGuard())
  @ApiOkResponse({ description: ResponseDescription.Success, type: CollectionStatsArrayResponseDto })
  @ApiUnauthorizedResponse({ description: ResponseDescription.Unauthorized })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  @UseInterceptors(new CacheControlInterceptor({ maxAge: 60 * 3 }))
  async GetWatchlist(
    @Query() user: UserDto,
    @Query() query: RankingsRequestDto
  ): Promise<CollectionStatsArrayResponseDto> {
    const watchlist = await this.userService.getUserWatchlist(user, query);

    const response: CollectionStatsArrayResponseDto = {
      data: watchlist,
      hasNextPage: false,
      cursor: ''
    };

    return response;
  }
}
