import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'common/guards/auth.guard';
import RankingsRequestDto from 'collections/dto/rankings-request.dto';
import { UserDto } from './dto/user.dto';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('watchlist')
  @UseGuards(new AuthGuard())
  async GetWatchlist(@Query() user: UserDto, @Query() query: RankingsRequestDto) {
    const watchlist = await this.userService.getUserWatchlist(user, query);
    return watchlist;
  }
}
