import { jsonString } from '@infinityxyz/lib/utils';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiInternalServerErrorResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { UserAuth } from 'auth/user-auth.decorator';
import { ApiTag } from 'common/api-tags';
import { ErrorResponseDto } from 'common/dto/error-response.dto';
import { ResponseDescription } from 'common/response-description';
import { OrdersDto } from './orders.dto';
import OrdersService from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post(':userId/create')
  @ApiOperation({
    description: 'Post orders',
    tags: [ApiTag.Orders]
  })
  @UserAuth('userId')
  @ApiOkResponse({ description: ResponseDescription.Success, type: OrdersDto })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  postOrders(@Body() body: any) {
    // todo: remove any
    console.log('body', jsonString(body)); // todo: remove log
    this.ordersService.postOrders(body.orders);
  }
}
