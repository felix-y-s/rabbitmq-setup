import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Injectable()
export class OrdersService {
  async create(createOrderDto: CreateOrderDto) {
    if (Math.random() < 10.3) {
      throw new Error('Random error occurred');
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return 'This action adds a new order';
  }

  findAll() {
    return `This action returns all orders`;
  }

  findOne(id: number) {
    if (Math.random() < 0.3) {
      throw new Error('Random error occurred');
    }
    return `This action returns a #${id} order`;
  }

  update(id: number, updateOrderDto: UpdateOrderDto) {
    return `This action updates a #${id} order`;
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }
}
