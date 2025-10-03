import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

export interface DLQMessage {
  messageId: string;
  routingKey: string;
  payload: any;
  headers: any;
  retryCount: number;
  failureReason: string;
  originalQueue: string;
  timestamp: number;
}

/**
 * DLQ 메시지 수동 관리 서비스
 * - DLQ 메시지 조회
 * - DLQ 메시지 재처리
 * - DLQ 메시지 삭제
 */
@Injectable()
export class DLQManagementService {
  private readonly logger = new Logger(DLQManagementService.name);
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    try {
      const rmqUrl = this.configService.get('RMQ_URL');
      this.connection = await amqp.connect(rmqUrl);
      this.channel = await this.connection.createChannel();
      this.logger.log('DLQ 관리 서비스 초기화 완료');
    } catch (error) {
      this.logger.error(`DLQ 관리 서비스 초기화 실패: ${error.message}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }

  /**
   * DLQ 상태 조회
   */
  async getDLQStatus() {
    try {
      const queueInfo = await this.channel.checkQueue('dlq_queue');

      return {
        queueName: 'dlq_queue',
        messageCount: queueInfo.messageCount,
        consumerCount: queueInfo.consumerCount,
      };
    } catch (error) {
      this.logger.error(`DLQ 상태 조회 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * DLQ 메시지 목록 조회 (페이징)
   */
  async getDLQMessages(
    limit: number = 10,
  ): Promise<{ count: number; messages: DLQMessage[] }> {
    try {
      const messages: DLQMessage[] = [];
      const fetchedMessages: amqp.Message[] = [];

      // 1단계: 메시지를 가져와서 임시 저장
      for (let i = 0; i < limit; i++) {
        const msg = await this.channel.get('dlq_queue', { noAck: false });

        if (!msg) {
          break; // 더 이상 메시지 없음
        }

        fetchedMessages.push(msg);
      }

      // 2단계: 가져온 메시지를 파싱하고 다시 큐에 넣기
      for (let i = 0; i < fetchedMessages.length; i++) {
        const msg = fetchedMessages[i];

        const content = JSON.parse(msg.content.toString());
        const xDeath = msg.properties.headers?.['x-death']?.[0];

        messages.push({
          messageId: msg.properties.messageId || `msg-${i}`,
          routingKey: msg.fields.routingKey,
          payload: content.data,
          headers: msg.properties.headers,
          retryCount: xDeath?.count || 0,
          failureReason: xDeath?.reason || 'unknown',
          originalQueue: xDeath?.queue || 'unknown',
          timestamp: xDeath?.time?.value || Date.now(),
        });

        // 메시지를 다시 큐에 넣음 (재조회 가능하도록)
        this.channel.nack(msg, false, true);
      }

      return {
        count: fetchedMessages.length,
        messages,
      };
    } catch (error) {
      this.logger.error(`DLQ 메시지 조회 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * orderId로 특정 DLQ 메시지 상세 조회
   */
  async getDLQMessageByOrderId(orderId: string): Promise<DLQMessage> {
    try {
      const fetchedMessages: amqp.Message[] = [];

      // 모든 메시지를 가져와서 임시 저장
      while (true) {
        const msg = await this.channel.get('dlq_queue', { noAck: false });

        if (!msg) {
          break;
        }

        fetchedMessages.push(msg);
      }

      // orderId로 메시지 찾기
      let targetMessage: DLQMessage | null = null;

      for (let i = 0; i < fetchedMessages.length; i++) {
        const msg = fetchedMessages[i];
        const content = JSON.parse(msg.content.toString());
        const xDeath = msg.properties.headers?.['x-death']?.[0];

        const dlqMessage: DLQMessage = {
          messageId: msg.properties.messageId || `msg-${i}`,
          routingKey: msg.fields.routingKey,
          payload: content.data,
          headers: msg.properties.headers,
          retryCount: xDeath?.count || 0,
          failureReason: xDeath?.reason || 'unknown',
          originalQueue: xDeath?.queue || 'unknown',
          timestamp: xDeath?.time?.value || Date.now(),
        };

        // 메시지를 다시 큐에 넣음
        this.channel.nack(msg, false, true);

        // orderId가 일치하면 저장
        if (content.data?.orderId === orderId) {
          targetMessage = dlqMessage;
        }
      }

      if (!targetMessage) {
        throw new NotFoundException(
          `orderId ${orderId}를 가진 메시지를 찾을 수 없습니다`,
        );
      }

      return targetMessage;
    } catch (error) {
      this.logger.error(`DLQ 메시지 상세 조회 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * orderId로 DLQ 메시지 재처리 (원본 큐로 재발행)
   */
  async reprocessDLQMessage(orderId: string): Promise<{ success: boolean }> {
    try {
      const fetchedMessages: amqp.Message[] = [];

      // 모든 메시지를 가져와서 임시 저장
      while (true) {
        const msg = await this.channel.get('dlq_queue', { noAck: false });

        if (!msg) {
          break;
        }

        fetchedMessages.push(msg);
      }

      // orderId로 메시지 찾기
      let targetMessage: amqp.Message | null = null;

      for (const msg of fetchedMessages) {
        const content = JSON.parse(msg.content.toString());

        if (content.data?.orderId === orderId) {
          targetMessage = msg;
          // 타겟 메시지는 재처리할 것이므로 큐에 다시 넣지 않음
        } else {
          // 다른 메시지는 다시 큐에 넣음
          this.channel.nack(msg, false, true);
        }
      }

      if (!targetMessage) {
        throw new NotFoundException(
          `orderId ${orderId}를 가진 메시지를 찾을 수 없습니다`,
        );
      }

      const content = JSON.parse(targetMessage.content.toString());
      const xDeath = targetMessage.properties.headers?.['x-death']?.[0];
      const originalQueue = xDeath?.queue || 'orders_queue';

      // 원본 큐로 재발행
      await this.channel.sendToQueue(originalQueue, targetMessage.content, {
        persistent: true,
        headers: {
          'x-reprocessed': true,
          'x-reprocessed-at': Date.now(),
          'x-original-failure-count': xDeath?.count || 0,
        },
      });

      // DLQ에서 메시지 제거 (ACK)
      this.channel.ack(targetMessage);

      this.logger.log(
        `DLQ 메시지 재처리 완료: orderId=${orderId}, ${originalQueue}로 재발행 (원본 실패 횟수: ${xDeath?.count})`,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(`DLQ 메시지 재처리 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * orderId로 DLQ 메시지 삭제
   */
  async deleteDLQMessage(orderId: string): Promise<{ success: boolean }> {
    try {
      const fetchedMessages: amqp.Message[] = [];

      // 모든 메시지를 가져와서 임시 저장
      while (true) {
        const msg = await this.channel.get('dlq_queue', { noAck: false });

        if (!msg) {
          break;
        }

        fetchedMessages.push(msg);
      }

      // orderId로 메시지 찾기
      let found = false;

      for (const msg of fetchedMessages) {
        const content = JSON.parse(msg.content.toString());

        if (content.data?.orderId === orderId) {
          // 목표 메시지 삭제 (ACK)
          this.channel.ack(msg);
          found = true;
          this.logger.log(`DLQ 메시지 삭제 완료: orderId=${orderId}`);
        } else {
          // 다른 메시지는 다시 큐에 넣음
          this.channel.nack(msg, false, true);
        }
      }

      if (!found) {
        throw new NotFoundException(
          `orderId ${orderId}를 가진 메시지를 찾을 수 없습니다`,
        );
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`DLQ 메시지 삭제 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 모든 DLQ 메시지 삭제 (purge)
   */
  async purgeAllDLQMessages(): Promise<{ deletedCount: number }> {
    try {
      const result = await this.channel.purgeQueue('dlq_queue');

      this.logger.warn(`모든 DLQ 메시지 삭제: ${result.messageCount}개`);

      return { deletedCount: result.messageCount };
    } catch (error) {
      this.logger.error(`DLQ 전체 삭제 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 모든 DLQ 메시지 일괄 재처리
   */
  async reprocessAllDLQMessages(): Promise<{ reprocessedCount: number }> {
    try {
      let reprocessedCount = 0;

      while (true) {
        const msg = await this.channel.get('dlq_queue', { noAck: false });

        if (!msg) {
          break; // 더 이상 메시지 없음
        }

        const xDeath = msg.properties.headers?.['x-death']?.[0];
        const originalQueue = xDeath?.queue || 'orders_queue';

        // 원본 큐로 재발행
        await this.channel.sendToQueue(originalQueue, msg.content, {
          persistent: true,
          headers: {
            'x-reprocessed': true,
            'x-reprocessed-at': Date.now(),
            'x-original-failure-count': xDeath?.count || 0,
          },
        });

        // DLQ에서 제거
        this.channel.ack(msg);
        reprocessedCount++;
      }

      this.logger.log(`일괄 재처리 완료: ${reprocessedCount}개 메시지`);

      return { reprocessedCount };
    } catch (error) {
      this.logger.error(`일괄 재처리 실패: ${error.message}`);
      throw error;
    }
  }
}
