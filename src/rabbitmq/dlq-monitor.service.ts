import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import * as amqp from 'amqplib';

/**
 * DLQ 모니터링 전용 서비스
 * - DLQ 큐를 주기적으로 확인
 * - 새 메시지 발견 시 알림 전송 (Slack, Email 등)
 * - 메시지를 컨슈밍하지 않고 확인만 함
 */
@Injectable()
export class DLQMonitorService {
  private readonly logger = new Logger(DLQMonitorService.name);
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    // provider에서 이미 조건부로 생성되므로, 여기서는 무조건 초기화
    try {
      const rmqUrl = this.configService.get('RMQ_URL');
      this.connection = await amqp.connect(rmqUrl);
      this.channel = await this.connection.createChannel();
      this.logger.log('✅ DLQ 모니터링 서비스 활성화 - 1분마다 확인');
    } catch (error) {
      this.logger.error(`DLQ 모니터링 초기화 실패: ${error.message}`);
      throw error; // 초기화 실패 시 에러 전파
    }
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
    this.logger.log('DLQ 모니터링 서비스 종료');
  }

  // 1분마다 DLQ 확인
  @Cron('0 * * * * *')
  async checkDLQMessages() {
    if (!this.channel) {
      this.logger.warn('DLQ 모니터링 채널이 초기화되지 않음');
      return;
    }

    try {
      // 메시지 개수만 확인 (컨슈밍 안 함)
      const queueInfo = await this.channel.checkQueue('dlq_queue');

      if (queueInfo.messageCount > 0) {
        this.logger.warn(
          `⚠️ DLQ에 ${queueInfo.messageCount}개의 실패 메시지가 있습니다!`,
        );

        // TODO: 알림 전송
        // await this.sendSlackAlert(queueInfo.messageCount);
        // await this.sendEmailAlert(queueInfo.messageCount);
      }
    } catch (error) {
      this.logger.error(`DLQ 모니터링 실패: ${error.message}`);
    }
  }

  // Slack 알림 예시
  private async sendSlackAlert(count: number) {
    // Slack Webhook 사용
    // await fetch(webhookUrl, {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     text: `🚨 DLQ 알림: ${count}개의 실패 메시지`,
    //   }),
    // });
  }
}
