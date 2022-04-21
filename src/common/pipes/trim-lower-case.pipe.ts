import { trimLowerCase } from '@infinityxyz/lib/utils/formatters';
import { Injectable } from '@nestjs/common/decorators/core/injectable.decorator';
import { PipeTransform } from '@nestjs/common/interfaces/features/pipe-transform.interface';

@Injectable()
export class TrimLowerCasePipe implements PipeTransform<string, string> {
  transform(value: string): string {
    return trimLowerCase(value);
  }
}
