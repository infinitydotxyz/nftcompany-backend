import { jsonString } from '@infinityxyz/lib/utils';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { ApiSignatureAuth } from 'api-signature.decorator';
import { ApiTag } from 'common/api-tags';
import { MatchSigner } from 'common/decorators/match-signer.decorator';
import { ApiParamUserId } from 'common/decorators/param-user-id.decorator';
import { ErrorResponseDto } from 'common/dto/error-response.dto';
import { AuthGuard } from 'common/guards/auth.guard';
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
  postOrders(@Body() body: any) { // todo: remove any
    console.log('body', jsonString(body));
    this.ordersService.postOrders(body.orders);
  }
}
