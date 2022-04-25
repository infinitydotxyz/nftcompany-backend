import { GetOrderItemsQuery, OBOrderStatus, OrderDirection, SignedOBOrder } from '@infinityxyz/lib/types/core';
import { DEFAULT_ITEMS_PER_PAGE, firestoreConstants, jsonString } from '@infinityxyz/lib/utils';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiInternalServerErrorResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { UserAuth } from 'auth/user-auth.decorator';
import { ApiTag } from 'common/api-tags';
import { ErrorResponseDto } from 'common/dto/error-response.dto';
import { ResponseDescription } from 'common/response-description';
import { FirebaseService } from 'firebase/firebase.service';
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
  // @UserAuth('userId') todo: uncomment
  @ApiOkResponse({ description: ResponseDescription.Success, type: OrdersDto })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: ResponseDescription.InternalServerError })
  public async postOrders(@Param('userId') userId: string, @Body() body: any): Promise<string> {
    // todo: remove any
    console.log('body', jsonString(body)); // todo: remove log
    const result = await this.ordersService.postOrders(userId, body.orders);
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
      firestoreQuery = orderItemsCollectionRef.where('collection', 'in', reqQuery.collections);
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
