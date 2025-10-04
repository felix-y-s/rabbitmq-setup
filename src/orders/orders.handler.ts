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

    if (!channel || !originalMessage) {
      this.logger.error('❌ RabbitMQ 컨텍스트를 가져올 수 없습니다');
      return;
    }

    // console.log('🚀 | OrdersHandler | handleOrderCreated | originalMessage:', {
    //   fields: originalMessage.fields,
    //   properties: originalMessage.properties,
    // });

    const headers = originalMessage.properties.headers;
    const xDeath = headers?.['x-death'];

    try {
      if (xDeath) {
        console.log(
          '🚀 | OrdersHandler | handleOrderCreated | xDeath:',
          xDeath,
        );
        // channel.ack(originalMessage);
        // return;
      }

      await this.ordersService.create(payload);

      channel.ack(originalMessage);
      this.logger.log(`✅ 주문 처리 완료 (orderId: ${payload.orderId})`);
    } catch (error) {
      this.logger.error(
        `❌ 주문 처리 실패 (orderId: ${payload.orderId}): ${error.message}`,
      );

      // TODO: 에러 정보를 별도 저장소에 기록 (Redis, DB 등)
      // await this.errorLogService.saveError(payload.orderId, {
      //   errorMessage: error.message,
      //   errorStack: error.stack,
      //   failedAt: new Date().toISOString(),
      //   payload: payload,
      // });

      // quorum 큐의 x-delivery-limit이 자동 재시도 처리
      // nack(requeue=true)하면 한도 초과 시 DLQ로 자동 이동
      channel.nack(originalMessage, false, true);
    }
  }

  @EventPattern('dlq.orders.created')
  async handleDLQOrders(@Payload() payload: any, @Ctx() ctx: RmqContext) {
    const channel = ctx.getChannelRef();
    const originalMessage = ctx.getMessage();

    if (!channel || !originalMessage) {
      this.logger.error('❌ RabbitMQ 컨텍스트를 가져올 수 없습니다');
      return;
    }

    // x-death 헤더에서 실패 정보 확인
    const headers = originalMessage.properties.headers;
    const xDeath = headers?.['x-death'];
    const retryCount = xDeath?.[0]?.count || 0;
    const failureReason = xDeath?.[0]?.reason || 'unknown';
    const originalQueue = xDeath?.[0]?.queue || 'unknown';

    this.logger.error(
      `🚨 DLQ 메시지 수신 (orderId: ${payload.orderId}) - ${originalQueue} 큐에서 ${retryCount}회 실패 (사유: ${failureReason})`,
    );
    this.logger.error(`📦 실패한 주문: ${JSON.stringify(payload)}`);

    // 디버깅이 필요한 경우 전체 정보 출력
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(`📊 x-death 상세: ${JSON.stringify(xDeath, null, 2)}`);
    }

    // TODO: 실패 메시지 처리
    // 1. 별도 저장소(Redis, DB)에서 에러 정보 조회
    // const errorLog = await this.errorLogService.getError(payload.orderId);
    // this.logger.error(`❌ 원본 에러: ${errorLog.errorMessage}`);
    // this.logger.error(`⏰ 실패 시각: ${errorLog.failedAt}`);
    //
    // 2. 에러 로그를 DB에 영구 저장
    // await this.failureLogRepository.save({
    //   orderId: payload.orderId,
    //   errorMessage: errorLog.errorMessage,
    //   errorStack: errorLog.errorStack,
    //   failedAt: errorLog.failedAt,
    //   retryCount: retryCount,
    //   payload: JSON.stringify(payload),
    // });
    //
    // 3. 관리자에게 알림 전송 (Slack, Email 등)
    // 4. 필요시 수동 재처리 큐로 이동

    // DLQ 메시지는 ACK 처리 (무한 루프 방지)
    channel.ack(originalMessage);
    this.logger.log(`✅ DLQ 메시지 처리 완료 (orderId: ${payload.orderId})`);
  }
}