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
  async market(@Body() listingDto: MarketListingsBodyDto): Promise<MarketListingsResponse> {
    try {
      let sellOrds: OBOrder[] = [];
      let buyOrds: OBOrder[] = [];
      let matches: BuyOrderMatch[] = [];
      let success = '';

      switch (listingDto.action) {
        case 'list':
          switch (listingDto.orderType) {
            case 'sellOrders':
              sellOrds = await sellOrders(listingDto.listId ?? 'validActive');
              break;
            case 'buyOrders':
              buyOrds = await buyOrders(listingDto.listId ?? 'validActive');
              break;
          }

          break;
        case 'delete':
          switch (listingDto.orderType) {
            case 'sellOrders':
              await deleteSellOrder(listingDto.listId ?? 'validActive', listingDto.orderId ?? '');

              success = `deleted sell: ${listingDto.orderId}`;
              break;
            case 'buyOrders':
              await deleteBuyOrder(listingDto.listId ?? 'validActive', listingDto.orderId ?? '');
              success = `deleted buy: ${listingDto.orderId}`;
              break;
          }

          break;
        case 'move':
          break;
        case 'buy':
          await marketOrders.executeBuyOrder(listingDto.orderId ?? '');
          success = `buy: ${listingDto.orderId}`;
          break;
        case 'match':
          matches = await marketOrders.marketMatches();
          break;
      }

      return { buyOrders: buyOrds, sellOrders: sellOrds, error: '', success: success, matches: matches };
    } catch (err) {
      error('Failed', err);
    }
  }
}
