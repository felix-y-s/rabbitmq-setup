import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, RmqOptions, Transport } from '@nestjs/microservices';
import { RabbitMQConsumerService } from './rabbitmq-consumer.service';

@Module({
  imports: [
    ClientsModule.registerAsync({
      isGlobal: true,
      clients: [
        {
          name: 'EVENT_CLIENT',
          useFactory: (configService: ConfigService): RmqOptions => {
            const rmqUrl = configService.get(
              'RMQ_URL',
              'amqp://localhost:5672',
            );

            return {
              transport: Transport.RMQ,
              options: {
                urls: [rmqUrl],
                exchange: 'events_exchange',
                exchangeType: 'topic',
                wildcards: true, // emit()에서 pattern을 routing key로 사용하도록 설정
                noAssert: true, // exchange/queue 생성 시도 안 함
                queue: 'orders_queue',
                queueOptions: {
                  durable: true,
                  arguments: {
                    'x-queue-type': 'quorum',
                    'x-delivery-limit': 2, // 3회 재시도
                    'x-dead-letter-exchange': 'dlq_exchange',
                    'x-dead-letter-routing-key': 'dlq.orders',
                  },
                },
              },
            };
          },
          inject: [ConfigService],
        },
      ],
    }),
  ],
  providers: [RabbitMQConsumerService],
})
export class RabbitMQModule {}
