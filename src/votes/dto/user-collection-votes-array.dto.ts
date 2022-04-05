import { ApiProperty } from '@nestjs/swagger';
import { UserCollectionVoteDto } from './user-collection-vote.dto';

export class UserCollectionVotesArrayDto {
  @ApiProperty({ description: 'Array of votes made by the user', type: [UserCollectionVoteDto] })
  data: UserCollectionVoteDto[];

  @ApiProperty({ description: 'Cursor that can be used to get the next page' })
  cursor: string;

  @ApiProperty({ description: 'Whether there are more votes available' })
  hasNextPage: boolean;
}
