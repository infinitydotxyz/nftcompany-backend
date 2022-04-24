import { GetOrdersQuery, SignedOBOrder } from '@infinityxyz/lib/types/core';
import { jsonString } from '@infinityxyz/lib/utils';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse, ApiOkResponse,
  ApiOperation
} from '@nestjs/swagger';
import { UserAuth } from 'auth/user-auth.decorator';
import { ApiTag } from 'common/api-tags';
import { ErrorResponseDto } from 'common/dto/error-response.dto';
import { ResponseDescription } from 'common/response-description';
import { OrdersDto } from './dto/orders.dto';
import OrdersService from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post(':userId/create')
  @ApiOperation({
    description: 'Post orders',
    tags: [ApiTag.Orders]
  })
  // @UserAuth('userId') todo: uncomment
  @ApiOkResponse({ description: ResponseDescription.Success, type: OrdersDto })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  postOrders(@Param() userId: string, @Body() body: any) {
    // todo: remove any
    console.log('body', jsonString(body)); // todo: remove log
    this.ordersService.postOrders(userId, body.orders);
  }

  // todo: uncomment
  @Get('get')
  // @ApiOperation({
  //   description: 'Get orders',
  //   tags: [ApiTag.Orders]
  // })
  @ApiOkResponse({ description: ResponseDescription.Success })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  async getOrders(@Query() query: GetOrdersQuery): Promise<SignedOBOrder[]> {
    const data = await this.ordersService.getOrders(query);
    return data;
  }
}
