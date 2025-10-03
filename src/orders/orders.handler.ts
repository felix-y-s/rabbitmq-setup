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
      await this.ordersService.create(payload);

      channel.ack(originalMessage);
      this.logger.log('✅ 주문 처리 완료');
    } catch (error) {
      this.logger.error(`❌ 주문 처리 실패: ${error.message}`);

      // quorum 큐의 x-delivery-limit이 자동 재시도 처리
      // nack(requeue=false)하면 한도 초과시 DLQ로 자동 이동
      channel.nack(originalMessage, false, true);
    }
  }

  @EventPattern('dlq.orders.created')
  async handleDLQOrders(@Payload() payload: any, @Ctx() ctx: RmqContext) {
    const channel = ctx.getChannelRef();
    const originalMessage = ctx.getMessage();

    // x-death 헤더에서 실패 정보 확인
    const xDeath = originalMessage.properties?.headers?.['x-death'];
    const retryCount = xDeath?.[0]?.count || 0;
    const failureReason = xDeath?.[0]?.reason || 'unknown';
    const originalQueue = xDeath?.[0]?.queue || 'unknown';

    this.logger.error(
      `🚨 DLQ 메시지 수신 - ${originalQueue} 큐에서 ${retryCount}회 실패 (사유: ${failureReason})`,
    );
    this.logger.error(`📦 실패한 주문: ${JSON.stringify(payload)}`);

    // 디버깅이 필요한 경우 x-death 전체 정보 출력
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(`📊 x-death 상세: ${JSON.stringify(xDeath, null, 2)}`);
    }

    // TODO: 실패 메시지 처리
    // 1. 에러 로그를 DB나 파일에 저장
    // 2. 관리자에게 알림 전송 (Slack, Email 등)
    // 3. 필요시 수동 재처리 큐로 이동

    // DLQ 메시지는 ACK 처리 (무한 루프 방지)
    channel.ack(originalMessage);
    this.logger.log('✅ DLQ 메시지 처리 완료');
  }
}