import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { KafkaUserEventPayload } from '../interfaces/user-payload.interface';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientKafka) {}

  async onModuleInit() {
    await this.kafkaClient.connect();
  }

  async onModuleDestroy() {
    await this.kafkaClient.close();
  }

  emitUserEvent(eventType: 'UserCreated' | 'UserUpdated', payload: KafkaUserEventPayload) {
    const topic = 'identity.iam.user.events';

    return this.kafkaClient.emit(topic, {
      key: payload.id.toString(),
      value: {
        event: eventType,
        user: payload,
      },
    });
  }
}
