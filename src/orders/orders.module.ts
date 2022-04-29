import { Module } from '@nestjs/common';
import { CollectionsModule } from 'collections/collections.module';
import { UserModule } from 'user/user.module';
import { OrdersController } from './orders.controller';
import OrdersService from './orders.service';

@Module({
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
  imports: [UserModule, CollectionsModule]
})
export class OrdersModule {}
