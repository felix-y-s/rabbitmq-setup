import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Inject,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ClientProxy } from '@nestjs/microservices';
import { v4 as uuid4 } from 'uuid';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    @Inject('EVENT_CLIENT') private readonly eventClient: ClientProxy,
  ) {}

  @Post()
  async create(@Body() createOrderDto: CreateOrderDto) {
    // 방법 1: emit() - 비동기 이벤트 발행 (응답 없음)
    this.eventClient
      .emit('orders.created', {
        orderId: uuid4(),
        ...createOrderDto,
      })
      .subscribe({
        next: () => console.log('✅ 이벤트 발행 완료'),
        error: (err) => console.error('❌ 이벤트 발행 실패:', err),
      });

    // 방법 2: send() - 동기 요청/응답 (응답 받기)
    // const response = await this.eventClient
    //   .send('orders.process', createOrderDto)
    //   .toPromise();

    // console.log('📥 핸들러 응답:', response);

    return {
      success: true,
      orderId: 1,
      // handlerResponse: response,
    };
  }

  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.ordersService.update(+id, updateOrderDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ordersService.remove(+id);
  }
}
