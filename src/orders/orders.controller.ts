import {
  GetMinBpsQuery,
  GetOrderItemsQuery,
  OBOrderStatus,
  OrderDirection,
  SignedOBOrder
} from '@infinityxyz/lib/types/core';
import { DEFAULT_ITEMS_PER_PAGE, firestoreConstants, jsonString } from '@infinityxyz/lib/utils';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiInternalServerErrorResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiParamUserId, ParamUserId } from 'auth/param-user-id.decorator';
import { UserAuth } from 'auth/user-auth.decorator';
import { ApiTag } from 'common/api-tags';
import { ErrorResponseDto } from 'common/dto/error-response.dto';
import { ResponseDescription } from 'common/response-description';
import { FirebaseService } from 'firebase/firebase.service';
import { ParseUserIdPipe } from 'user/parser/parse-user-id.pipe';
import { ParsedUserId } from 'user/parser/parsed-user-id';
import { sleep } from 'utils';
import { OrdersDto } from './dto/orders.dto';
import OrdersService from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService, private firebaseService: FirebaseService) {}

  @Post(':userId/create')
  @ApiOperation({
    description: 'Post orders',
    tags: [ApiTag.Orders]
  })
  @UserAuth('userId')
  @ApiOkResponse({ description: ResponseDescription.Success, type: String })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  public async postOrders(
    @ParamUserId('userId', ParseUserIdPipe) user: ParsedUserId,
    @Body() body: OrdersDto
  ): Promise<string> {
    const maker = user.userAddress;
    console.log('body', jsonString(body)); // todo: remove log
    // const result = await this.ordersService.postOrders(userId, body.orders);
    await sleep(200);
    return '';
  }

  @Get('/minbps')
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

  // todo: uncomment
  @Get('get')
  // @ApiOperation({
  //   description: 'Get orders',
  //   tags: [ApiTag.Orders]
  // })
  @ApiOkResponse({ description: ResponseDescription.Success })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  public async getOrders(@Query() reqQuery: GetOrderItemsQuery): Promise<SignedOBOrder[]> {
    const orderItemsCollectionRef = this.firebaseService.firestore.collectionGroup(
      firestoreConstants.ORDER_ITEMS_SUB_COLL
    );
    // default fetch valid active orders
    let firestoreQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
    if (reqQuery.orderStatus) {
      firestoreQuery = orderItemsCollectionRef.where('orderStatus', '==', reqQuery.orderStatus);
    } else {
      firestoreQuery = orderItemsCollectionRef.where('orderStatus', '==', OBOrderStatus.ValidActive);
    }
    // other filters
    if (reqQuery.chainId) {
      firestoreQuery = orderItemsCollectionRef.where('chainId', '==', reqQuery.chainId);
    }
    if (reqQuery.isSellOrder !== undefined) {
      firestoreQuery = firestoreQuery.where('isSellOrder', '==', reqQuery.isSellOrder);
    }
    if (reqQuery.minPrice !== undefined) {
      firestoreQuery = orderItemsCollectionRef.where('startPriceEth', '>=', reqQuery.minPrice);
    }
    if (reqQuery.maxPrice !== undefined) {
      firestoreQuery = orderItemsCollectionRef.where('startPriceEth', '<=', reqQuery.maxPrice);
    }
    if (reqQuery.numItems !== undefined) {
      firestoreQuery = firestoreQuery.where('numItems', '==', reqQuery.numItems);
    }
    if (reqQuery.collections && reqQuery.collections.length > 0) {
      firestoreQuery = orderItemsCollectionRef.where('collectionAddress', 'in', reqQuery.collections);
    }

    // ordering
    if (reqQuery.orderBy) {
      firestoreQuery = firestoreQuery.orderBy(reqQuery.orderBy, reqQuery.orderByDirection);
    } else {
      // default order by startTimeMs desc
      firestoreQuery = firestoreQuery.orderBy('startTimeMs', OrderDirection.Descending);
    }

    // pagination
    if (reqQuery.cursor) {
      firestoreQuery = orderItemsCollectionRef.startAfter(reqQuery.cursor);
    }
    // limit
    firestoreQuery = firestoreQuery.limit(reqQuery.limit || DEFAULT_ITEMS_PER_PAGE);

    // query firestore
    const data = await this.ordersService.getOrders(firestoreQuery);
    return data;
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
