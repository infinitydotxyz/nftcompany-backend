import { Module } from '@nestjs/common';
import { CollectionsModule } from 'collections/collections.module';
import { EthereumModule } from 'ethereum/ethereum.module';
import { PaginationModule } from 'pagination/pagination.module';
import { UserModule } from 'user/user.module';
import { OrdersController } from './orders.controller';
import OrdersService from './orders.service';

@Module({
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
  imports: [UserModule, CollectionsModule, EthereumModule, PaginationModule]
})
export class OrdersModule {}
