import { jsonString } from '@infinityxyz/lib/utils';
import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { ErrorResponseDto } from 'common/dto/error-response.dto';
import { ResponseDescription } from 'common/response-description';
import { OrdersDto } from './orders.dto';
import OrdersService from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  // todo: uncomment
  @Post(':userId/create')
  // @ApiParamUserId('userId')
  // @ApiSignatureAuth()
  // @UseGuards(AuthGuard)
  // @MatchSigner('userId')
  // @ApiOperation({
  //   description: 'Post orders',
  //   tags: [ApiTag.Orders]
  // })
  @ApiOkResponse({ description: ResponseDescription.Success, type: OrdersDto })
  @ApiUnauthorizedResponse({ description: ResponseDescription.Unauthorized })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  postOrders(@Body() body: any) {
    // todo: remove any
    console.log('body', jsonString(body)); // todo: remove log
    this.ordersService.postOrders(body.orders);
  }
}
