import { OBOrder, BuyOrderMatch, MarketListingsResponse } from '@infinityxyz/lib/types/core';
import { error } from '@infinityxyz/lib/utils';
import { Body, Controller, Post } from '@nestjs/common';
import { sellOrders, buyOrders, deleteSellOrder, deleteBuyOrder } from 'routes/marketListings/marketFirebase';
import { marketOrders } from 'routes/marketListings/marketOrders';
import { ApiBadRequestResponse, ApiOkResponse } from '@nestjs/swagger';
import { ResponseDescription } from 'common/response-description';
import { MarketListingsBodyDto } from './market-listings.dto';
import { ErrorResponseDto } from 'common/dto/error-response.dto';

@Controller('market-listings')
export class MarketListingsController {
  @Post()
  @ApiOkResponse({ description: ResponseDescription.Success, type: MarketListingsBodyDto })
  @ApiBadRequestResponse({ description: ResponseDescription.BadRequest, type: ErrorResponseDto })
  async create(@Body() body: MarketListingsBodyDto): Promise<MarketListingsResponse> {
    try {
      let sellOrds: OBOrder[] = [];
      let buyOrds: OBOrder[] = [];
      let matches: BuyOrderMatch[] = [];
      let success = '';

      // Not working?
      console.log(body);

      switch (body.action) {
        case 'list':
          switch (body.orderType) {
            case 'sellOrders':
              sellOrds = await sellOrders(body.listId ?? 'validActive');
              break;
            case 'buyOrders':
              buyOrds = await buyOrders(body.listId ?? 'validActive');
              break;
          }

          break;
        case 'delete':
          switch (body.orderType) {
            case 'sellOrders':
              await deleteSellOrder(body.listId ?? 'validActive', body.orderId ?? '');

              success = `deleted sell: ${body.orderId}`;
              break;
            case 'buyOrders':
              await deleteBuyOrder(body.listId ?? 'validActive', body.orderId ?? '');
              success = `deleted buy: ${body.orderId}`;
              break;
          }

          break;
        case 'move':
          break;
        case 'buy':
          await marketOrders.executeBuyOrder(body.orderId ?? '');
          success = `buy: ${body.orderId}`;
          break;
        case 'match':
          matches = await marketOrders.marketMatches();
          break;
      }

      return {
        buyOrders: { orders: buyOrds, cursor: '' },
        sellOrders: { orders: sellOrds, cursor: '' },
        error: '',
        success: success,
        matches: matches
      };
    } catch (err) {
      error('Failed', err);
    }
  }
}
