import { PipeTransform, Injectable } from '@nestjs/common';
import { ParsedUserId } from './parser/parsed-user-id';
import { UserParserService } from './parser/user-parser.service';

@Injectable()
export class ParseUserIdPipe implements PipeTransform<string, Promise<ParsedUserId>> {
  constructor(private userParserService: UserParserService) {}

  async transform(value: string): Promise<ParsedUserId> {
    return await this.userParserService.parse(value);
  }
}
