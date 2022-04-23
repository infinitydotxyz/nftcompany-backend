import { OrderDirection } from '@infinityxyz/lib/types/core';
import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginatedQuery } from 'common/dto/paginated-query.dto';

export class TopOwnersQueryDto extends PickType(PaginatedQuery, ['cursor', 'limit'] as const) {
  @ApiPropertyOptional({
    description: 'Direction to order results by. Defaults to `desc`',
    enum: OrderDirection
  })
  @IsEnum(OrderDirection)
  @IsOptional()
  orderDirection?: OrderDirection;
}
