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

    // dead letter exchange 생성
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [rmqUrl],
        queue: 'dlq_queue',
        queueOptions: {
          durable: true,
          messageTtl: 604800000, // 7일 - DLQ 메시지 분석/디버깅 시간 확보
        },
        exchange: 'dlq_exchange',
        socketOptions: {
          heartbeatIntervalInSeconds: 60,
          reconnectTimeInSeconds: 5,
        },
        routingKey: 'dlq.*',
      }
    })

    // Orders consumer
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [rmqUrl],
        queue: 'orders_queue',
        queueOptions: {
          durable: true, // quorum 큐는 반드시 durable: true
          // deadLetterExchange: 'dlq_exchange',
          // deadLetterRoutingKey: 'orders.dlq',
          messageTtl: 86400000, // 24시간
          arguments: {
            'x-queue-type': 'quorum',
            'x-delivery-limit': 2, // 3회 재시도
            'x-dead-letter-exchange': 'dlq_exchange',
            'x-dead-letter-routing-key': 'dlq.orders',
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
