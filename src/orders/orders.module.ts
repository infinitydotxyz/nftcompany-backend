import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import OrdersService from './orders.service';
import { ParseUserIdPipe } from 'user/user-id.pipe';

@Module({
  providers: [OrdersService, ParseUserIdPipe],
  controllers: [OrdersController],
  exports: [OrdersService]
})
export class OrdersModule {}
