import { PickType } from '@nestjs/swagger';
import { UserCollectionVoteDto } from './user-collection-vote.dto';

export class UserCollectionVoteBodyDto extends PickType(UserCollectionVoteDto, ['votedFor'] as const) {}
