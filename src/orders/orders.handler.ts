import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { OrdersService } from './orders.service';

@Controller()
export class OrdersHandler {
  private readonly logger = new Logger(OrdersHandler.name);

  constructor(private readonly ordersService: OrdersService) {}
  @EventPattern('orders.created')
  async handleOrderCreated(@Payload() payload: any, @Ctx() ctx: RmqContext) {
    const channel = ctx.getChannelRef();
    const originalMessage = ctx.getMessage();

    try {
      this.logger.log(`📥 주문 생성 이벤트 수신: ${JSON.stringify(payload)}`);

      await this.ordersService.create(payload);

      channel.ack(originalMessage);
      this.logger.log('✅ 주문 생성 이벤트 처리 완료');
    } catch (error) {
      this.logger.error(`❌ 주문 처리 실패: ${error.message}`);
      channel.nack(originalMessage, false, true);
    }
  }

  @EventPattern('orders.dlq')
  async handleOrderEvent(@Payload() payload: any, @Ctx() ctx: RmqContext) {
    const channel = ctx.getChannelRef();
    const originalMessage = ctx.getMessage();

    this.logger.log(
      `📥 orders.dlq] 주문 생성 이벤트 수신: ${JSON.stringify(payload)}`,
    );
  }
}