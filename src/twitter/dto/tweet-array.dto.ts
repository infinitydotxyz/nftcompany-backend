import { ApiProperty } from '@nestjs/swagger';
import { TweetDto } from './tweet.dto';

export class TweetArrayDto {
  @ApiProperty({ description: 'Array of tweets', type: [TweetDto] })
  data!: TweetDto[];

  @ApiProperty({ description: 'Cursor that can be used to get the next page' })
  cursor!: string;

  @ApiProperty({ description: 'Whether there are more results available' })
  hasNextPage!: boolean;
}
