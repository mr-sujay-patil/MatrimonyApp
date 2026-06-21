import { Kafka } from 'kafkajs';
import { Logger } from '@matrimony/shared-logger';

const logger = new Logger('kanban-kafka-config');

const bootstrapServers = process.env.KAFKA_BOOTSTRAP_SERVERS || '';
export const kafkaTopic = process.env.KAFKA_TOPIC_BACKLOG_EVENTS || 'dev.agile.backlog.events';

export let kafka: Kafka | null = null;

if (bootstrapServers) {
  logger.info(`Initializing Kafka client with brokers: ${bootstrapServers}`);
  kafka = new Kafka({
    clientId: 'kanban-board-service',
    brokers: bootstrapServers.split(','),
    retry: {
      initialRetryTime: 300,
      retries: 5
    }
  });
} else {
  logger.warn('KAFKA_BOOTSTRAP_SERVERS is empty. Kafka integration is disabled.');
}
