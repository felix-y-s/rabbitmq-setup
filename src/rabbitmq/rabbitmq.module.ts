import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, RmqOptions, Transport } from '@nestjs/microservices';
import { RabbitMQConsumerService } from './rabbitmq-consumer.service';
import { DLQMonitorService } from './dlq-monitor.service';

@Module({})
export class RabbitMQModule {
  static forRoot(): DynamicModule {
    return {
      module: RabbitMQModule,
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
                    noAssert: true,
                    // routingKey: 'orders.*',
                    // queue: 'orders_queue',
                    wildcards: true, // 👍 emit()의 pattern을 routing key로 사용 (routingKey, queue 셋팅이 있으면 안됨, consumer에는 셋팅 안함)
                  },
                };
              },
              inject: [ConfigService],
            },
          ],
        }),
      ],
      providers: [
        RabbitMQConsumerService,
        // DLQMonitorService는 조건부로 추가
        {
          provide: DLQMonitorService,
          useFactory: (configService: ConfigService) => {
            const enableMonitor =
              configService.get('ENABLE_DLQ_MONITOR') === 'true';
            return enableMonitor ? new DLQMonitorService(configService) : null;
          },
          inject: [ConfigService],
        },
      ],
      exports: [RabbitMQConsumerService],
    };
  }
}
