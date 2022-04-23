import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import OrdersService from './orders.service';

@Module({
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService]
})
export class OrdersModule {}
