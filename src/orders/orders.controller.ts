import { GetMinBpsQuery } from '@infinityxyz/lib/types/core';
import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiInternalServerErrorResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ParamUserId } from 'auth/param-user-id.decorator';
import { UserAuth } from 'auth/user-auth.decorator';
import { instanceToPlain } from 'class-transformer';
import { ApiTag } from 'common/api-tags';
import { ErrorResponseDto } from 'common/dto/error-response.dto';
import { InvalidCollectionError } from 'common/errors/invalid-collection.error';
import { InvalidTokenError } from 'common/errors/invalid-token-error';
import { ResponseDescription } from 'common/response-description';
import { FirebaseService } from 'firebase/firebase.service';
import { ParseUserIdPipe } from 'user/parser/parse-user-id.pipe';
import { ParsedUserId } from 'user/parser/parsed-user-id';
import { OrderItemsQueryDto } from './dto/order-items-query.dto';
import { OrdersDto } from './dto/orders.dto';
import { SignedOBOrderDto } from './dto/signed-ob-order.dto';
import { SignedOBOrderArrayDto } from './dto/signed-ob-order-array.dto';
import OrdersService from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService, private firebaseService: FirebaseService) {}

  @Post(':userId')
  @ApiOperation({
    description: 'Post orders',
    tags: [ApiTag.Orders]
  })
  @UserAuth('userId')
  @ApiOkResponse({ description: ResponseDescription.Success, type: String })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  public async postOrders(
    @ParamUserId('userId', ParseUserIdPipe) maker: ParsedUserId,
    @Body() body: OrdersDto
  ): Promise<void> {
    try {
      const orders = (body.orders ?? []).map((item) => instanceToPlain(item)) as SignedOBOrderDto[];
      await this.ordersService.createOrder(maker, orders);
    } catch (err) {
      if (err instanceof InvalidCollectionError) {
        throw new BadRequestException(err.message);
      } else if (err instanceof InvalidTokenError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }

  @Post(':userId/create')
  @ApiOperation({
    description: 'Post orders',
    tags: [ApiTag.Orders],
    deprecated: true
  })
  @UserAuth('userId')
  @ApiOkResponse({ description: ResponseDescription.Success, type: String })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  public async postOrdersDeprecated(
    @ParamUserId('userId', ParseUserIdPipe) maker: ParsedUserId,
    @Body() body: OrdersDto
  ): Promise<void> {
    // TODO delete once FE is changed. this endpoint is deprecated prefer to use POST /orders/:userId
    try {
      const orders = (body.orders ?? []).map((item) => instanceToPlain(item)) as SignedOBOrderDto[];
      await this.ordersService.createOrder(maker, orders);
    } catch (err) {
      if (err instanceof InvalidCollectionError) {
        throw new BadRequestException(err.message);
      } else if (err instanceof InvalidTokenError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }

  @Get('minbps')
  @ApiOperation({
    description: 'Fetch MinBps',
    tags: [ApiTag.Orders]
  })
  @ApiOkResponse({ description: ResponseDescription.Success, type: Number })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  public async fetchMinBps(@Query() query: GetMinBpsQuery): Promise<number> {
    const chainId = query.chainId ?? '1';
    console.log('collections', query.collections);
    const collections = query.collections ?? [];
    const result = await this.ordersService.fetchMinBps(chainId, collections);
    return result;
  }

  @Get()
  @ApiOperation({
    description: 'Get orders',
    tags: [ApiTag.Orders]
  })
  @ApiOkResponse({ description: ResponseDescription.Success, type: SignedOBOrderArrayDto })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  public async getOrders(@Query() reqQuery: OrderItemsQueryDto): Promise<SignedOBOrderArrayDto> {
    const results = await this.ordersService.getSignedOBOrders(reqQuery);
    return results;
  }

  @Get('get')
  @ApiOperation({
    description: 'Get orders',
    tags: [ApiTag.Orders],
    deprecated: true
  })
  @ApiOkResponse({ description: ResponseDescription.Success, type: SignedOBOrderArrayDto })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  public async getOrdersDeprecated(@Query() reqQuery: OrderItemsQueryDto): Promise<SignedOBOrderArrayDto> {
    // TODO delete once FE is changed. this endpoint is deprecated prefer to use GET /orders
    const results = await this.ordersService.getSignedOBOrders(reqQuery);
    return results;
  }

  // todo: uncomment
  @Get(':userId/nonce')
  // @ApiOperation({
  //   description: 'Get order nonce for user',
  //   tags: [ApiTag.Orders]
  // })
  @ApiOkResponse({ description: ResponseDescription.Success })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  public async getOrderNonce(@Param('userId') userId: string): Promise<string> {
    return await this.ordersService.getOrderNonce(userId);
  }
}
