import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import OrdersService from './orders.service';
import { TestModule } from 'test.module';

describe('OrdersController', () => {
  let controller: OrdersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule],
      controllers: [OrdersController],
      providers: [OrdersService]
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
