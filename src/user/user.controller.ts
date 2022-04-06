import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  NotFoundException,
  Post,
  Put,
  Query,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  HttpStatus,
  Headers
} from '@nestjs/common';
import { AuthGuard } from 'common/guards/auth.guard';
import { UserDto } from './dto/user.dto';
import { UserService } from './user.service';
import {
  ApiConsumes,
  ApiCreatedResponse,
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { ApiTag } from 'common/api-tags';
import { ResponseDescription } from 'common/response-description';
import { CollectionStatsArrayResponseDto } from 'stats/dto/collection-stats-array.dto';
import RankingsRequestDto from 'collections/dto/rankings-query.dto';
import { ApiSignatureAuth } from 'api-signature.decorator';
import { CacheControlInterceptor } from 'common/interceptors/cache-control.interceptor';
import { VotesService } from 'votes/votes.service';
import { UserCollectionVotesArrayDto } from 'votes/dto/user-collection-votes-array.dto';
import { ApiParamUserId, ParamUserId } from 'common/decorators/param-user-id.decorator';
import { ParseUserIdPipe } from './user-id.pipe';
import { UserCollectionVotesQuery } from 'votes/dto/user-collection-votes-query.dto';
import { UserCollectionVoteDto } from 'votes/dto/user-collection-vote.dto';
import { UserCollectionVoteBodyDto } from 'votes/dto/user-collection-vote-body.dto';
import { InvalidCollectionError } from 'common/errors/invalid-collection.error';
import { MatchSigner } from 'common/decorators/match-signer.decorator';
import { ParseCollectionIdPipe, ParsedCollectionId } from 'collections/collection-id.pipe';
import { UpdateCollectionDto } from 'collections/dto/collection.dto';
import { ApiParamCollectionId, ParamCollectionId } from 'common/decorators/param-collection-id.decorator';
import CollectionsService from 'collections/collections.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from 'storage/storage.service';
import { CollectionMetadata } from '@infinityxyz/lib/types/core';
import { instanceToPlain } from 'class-transformer';
import { StatsService } from 'stats/stats.service';

@Controller('user')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private userService: UserService,
    private votesService: VotesService,
    private collectionsService: CollectionsService,
    private storageService: StorageService,
    private statsService: StatsService
  ) {}

  @Get(':userId/watchlist')
  @ApiOperation({
    description: "Get a user's watchlist",
    tags: [ApiTag.User, ApiTag.Stats]
  })
  @ApiParamUserId('userId')
  @ApiSignatureAuth()
  @UseGuards(AuthGuard)
  @MatchSigner('userId')
  @ApiOkResponse({ description: ResponseDescription.Success, type: CollectionStatsArrayResponseDto })
  @ApiUnauthorizedResponse({ description: ResponseDescription.Unauthorized })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  @UseInterceptors(new CacheControlInterceptor({ maxAge: 60 * 3 }))
  async getWatchlist(
    @ParamUserId('userId', ParseUserIdPipe) user: UserDto,
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

  @Get(':userId/collections/votes')
  @ApiSignatureAuth()
  @UseGuards(AuthGuard)
  @MatchSigner('userId')
  @ApiOperation({
    description: "Get a user's votes on collections",
    tags: [ApiTag.User, ApiTag.Votes]
  })
  @ApiParamUserId('userId')
  @ApiOkResponse({ description: ResponseDescription.Success, type: UserCollectionVotesArrayDto })
  @ApiUnauthorizedResponse({ description: ResponseDescription.Unauthorized })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  @UseInterceptors(new CacheControlInterceptor())
  async getUserCollectionVotes(
    @ParamUserId('userId', ParseUserIdPipe) user: UserDto,
    @Query() query: UserCollectionVotesQuery
  ): Promise<UserCollectionVotesArrayDto> {
    const userVotes = await this.votesService.getUserVotes(user, query);
    return userVotes;
  }

  @Post(':userId/collections/votes')
  @ApiSignatureAuth()
  @UseGuards(AuthGuard)
  @MatchSigner('userId')
  @ApiOperation({
    description: "Update a user's vote on a collection",
    tags: [ApiTag.User, ApiTag.Votes]
  })
  @ApiParamUserId('userId')
  @ApiCreatedResponse({ description: ResponseDescription.Success })
  @ApiUnauthorizedResponse({ description: ResponseDescription.Unauthorized })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  @UseInterceptors(new CacheControlInterceptor())
  async saveUserCollectionVote(
    @ParamUserId('userId', ParseUserIdPipe) user: UserDto,
    @Body() vote: UserCollectionVoteBodyDto
  ): Promise<void> {
    const userVote: UserCollectionVoteDto = {
      ...vote,
      userAddress: user.userAddress,
      userChainId: user.userChainId,
      updatedAt: Date.now()
    };

    try {
      await this.votesService.saveUserCollectionVote(userVote);
    } catch (err) {
      if (err instanceof InvalidCollectionError) {
        throw new NotFoundException(err.message);
      }
      throw err;
    }
  }

  @Put(':userId/collections/:collectionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @UseInterceptors(new CacheControlInterceptor())
  @UseInterceptors(FileInterceptor('profileImage'))
  @ApiSignatureAuth()
  @ApiOperation({
    description: 'Update collection information',
    tags: [ApiTag.User, ApiTag.Collection]
  })
  @ApiParamUserId('userId')
  @ApiParamCollectionId('collectionId')
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiHeader({
    name: 'Content-Type',
    required: false
  })
  @ApiUnauthorizedResponse({ description: ResponseDescription.Unauthorized })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  async updateCollection(
    @ParamUserId('userId', ParseUserIdPipe) { userAddress }: UserDto,
    @ParamCollectionId('collectionId', ParseCollectionIdPipe) collection: ParsedCollectionId,
    @Headers('Content-Type') contentType: string,
    @Body() { metadata = {}, deleteProfileImage }: UpdateCollectionDto,
    @UploadedFile() profileImage: Express.Multer.File
  ) {
    if (!(await this.collectionsService.canModify(userAddress, collection))) {
      throw new UnauthorizedException();
    }

    if (deleteProfileImage) {
      metadata.profileImage = '';
    }

    // Upload image if we're submitting a file.
    // Note that we can't both update the collection and update the image at the same time.
    // This is done intentionally to keep things simpler.
    if (contentType === 'multipart/form-data' && profileImage && profileImage.size > 0) {
      const image = await this.storageService.saveImage(profileImage.filename, {
        contentType: profileImage.mimetype,
        data: profileImage.buffer
      });
      metadata.profileImage = image.publicUrl();
    }

    await this.collectionsService.setCollectionMetadata(collection, instanceToPlain(metadata) as CollectionMetadata);

    // Update stats in the background (do NOT await this call).
    this.statsService.getCurrentSocialsStats(collection.ref).catch((err) => this.logger.error(err));
  }
}
