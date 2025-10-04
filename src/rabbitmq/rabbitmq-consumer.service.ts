import { INestApplication, Injectable, Logger} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

@Injectable()
export class RabbitMQConsumerService {
  private readonly logger = new Logger(RabbitMQConsumerService.name);
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {}

  async initConsumers(app: INestApplication) {
    if (this.isInitialized) {
      this.logger.warn('RabbitMQ consumers already initialized. Skipping...');
      return;
    }

    const rmqUrl = this.configService.get('RMQ_URL', 'amqp://localhost:5672');
    this.logger.log(`Initializing RabbitMQ consumers with URL: ${rmqUrl}`);

    // ==========================================
    // DLQ 처리 전략 선택
    // ==========================================

    // 전략 1: 모니터링 전용 DLQ (권장 - 프로덕션)
    // - DLQ 큐는 생성되지만 자동 컨슈머 없음
    // - 실패 메시지는 DLQ에 저장만 됨
    // - RabbitMQ Management UI에서 수동 확인
    // - 필요 시 수동으로 메시지 재처리
    // - 장점: 안전, 무한 루프 없음, 명확한 실패 추적
    // - 단점: 자동 알림 없음, 수동 개입 필요

    // 전략 2: 자동 처리 DLQ (현재 구현 - 개발/테스트)
    // - DLQ 메시지를 자동으로 컨슈밍
    // - 실시간 알림/로깅 가능
    // - 장점: 즉각적인 피드백
    // - 단점: 패턴 해킹 필요, 확장성 제한
    const dlqMode = this.configService.get('DLQ_MODE', 'auto');

    this.logger.log(`📋 DLQ 모드: ${dlqMode}`);

    if (dlqMode === 'auto') {
      // 자동 처리 DLQ 컨슈머
      app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.RMQ,
        options: {
          urls: [rmqUrl],
          queue: 'dlq_queue',
          queueOptions: {
            durable: true,
          },
          exchange: 'dlq_exchange',
          exchangeType: 'topic',
          socketOptions: {
            heartbeatIntervalInSeconds: 60,
            reconnectTimeInSeconds: 5,
          },
          routingKey: 'dlq.#',
          noAck: false,
          deserializer: {
            deserialize: (value: any) => {
              // Workaround: 패턴 강제 변환
              const dlqPattern = 'dlq.' + value.pattern;
              return { pattern: dlqPattern, data: value.data };
            },
          },
        },
      });
    }

    // 모니터링 전용 모드에서는 DLQ 큐가 자동 생성됨
    // orders_queue 설정의 x-dead-letter-exchange에 의해

    // Orders consumer
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [rmqUrl],
        queue: 'orders_queue',
        queueOptions: {
          durable: true, // quorum 큐는 반드시 durable: true
          deadLetterExchange: 'dlq_exchange',
          deadLetterRoutingKey: 'dlq.orders',
          messageTtl: 86400000, // 24시간
          arguments: {
            'x-queue-type': 'quorum',
            'x-delivery-limit': 3, // 3회 재시도
          },
        },
        routingKey: 'orders.*',
        exchange: 'events_exchange',
        socketOptions: {
          heartbeatIntervalInSeconds: 60,
          reconnectTimeInSeconds: 5,
        },
        noAck: false,
      },
    });

    await app.startAllMicroservices();
    this.isInitialized = true;
    this.logger.log('RabbitMQ consumers initialized successfully');
  }
}
