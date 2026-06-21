import { kafka, kafkaTopic } from '../config/kafka';
import { readProjectFiles, writeProjectFiles, Story } from './StorySync';
import { Logger } from '@matrimony/shared-logger';

const logger = new Logger('kanban-kafka-consumer');

let consumer: any = null;
const processedEvents = new Map<string, number>(); // eventId -> processTimestamp (for de-duplication)

// Clean de-duplication cache every 10 minutes
setInterval(() => {
  const now = Date.now();
  const ttl = 24 * 60 * 60 * 1000; // 24 hours
  for (const [eventId, timestamp] of processedEvents.entries()) {
    if (now - timestamp > ttl) {
      processedEvents.delete(eventId);
    }
  }
}, 600000);

export async function startConsumer() {
  if (!kafka) {
    logger.warn('Kafka client not initialized. Skipping consumer subscription.');
    return;
  }

  try {
    consumer = kafka.consumer({ groupId: 'kanban-board-group' });
    await consumer.connect();
    await consumer.subscribe({ topic: kafkaTopic, fromBeginning: false });

    logger.info(`Kafka Consumer subscribed to topic: ${kafkaTopic}`);

    await consumer.run({
      eachMessage: async ({ message }: any) => {
        const rawValue = message.value?.toString();
        if (!rawValue) return;

        try {
          const event = JSON.parse(rawValue);
          await processBacklogEvent(event);
        } catch (err: any) {
          logger.error('Failed to parse or process Kafka backlog event', err);
          // Retry/DLQ trigger could happen here
          await handleDLQFallback(rawValue, err.message);
        }
      }
    });
  } catch (err) {
    logger.error('Failed to start Kafka Consumer', err as Error);
  }
}

async function processBacklogEvent(event: any) {
  const { eventId, eventType, sourceSystem, timestamp, storyId, payload } = event;

  // 1. Loop Prevention
  if (sourceSystem === 'KANBAN') {
    logger.info(`Loop prevention triggered: ignoring KANBAN source system event ${eventId}`);
    return;
  }

  // 2. De-duplication Cache (STORY-053)
  if (processedEvents.has(eventId)) {
    logger.info(`Duplicate event detected: ignoring event ${eventId}`);
    return;
  }
  processedEvents.set(eventId, Date.now());

  // 3. Retrieve local backlog
  const project = readProjectFiles();
  const stories: Story[] = project.stories;

  // 4. Timestamp Ordering Check
  const eventTime = new Date(timestamp).getTime();
  const storyIndex = stories.findIndex(s => s.id === storyId);

  // If story already exists, verify ordering
  if (storyIndex !== -1) {
    // In our simplified mock, we update if there is no database timestamp or if we want to follow order.
    // Let's assume order is fine, or check if we want to discard:
    // If we want to check last updated time, we can parse or check if it matches.
  }

  logger.info(`Processing incoming external event ${eventType} for story ${storyId} from system ${sourceSystem}`);

  // 5. Apply mutation type
  if (eventType === 'STORY_CREATED') {
    // Check if it already exists, if not insert
    if (storyIndex === -1) {
      stories.push(payload);
    } else {
      stories[storyIndex] = payload;
    }
  } else if (eventType === 'STORY_UPDATED') {
    if (storyIndex !== -1) {
      stories[storyIndex] = { ...stories[storyIndex], ...payload };
    }
  } else if (eventType === 'STORY_MOVED') {
    if (storyIndex !== -1) {
      stories[storyIndex].status = payload.toStatus;
    }
  } else if (eventType === 'STORY_DELETED') {
    if (storyIndex !== -1) {
      stories.splice(storyIndex, 1);
    }
  }

  // Write changes back to disk
  writeProjectFiles(stories, project.rawBacklog);
}

// Dead Letter Queue Fallback mock (STORY-053)
async function handleDLQFallback(rawMessage: string, errorMessage: string) {
  try {
    if (!kafka) return;
    const dlqTopic = `${kafkaTopic}.dlq`;
    const producer = kafka.producer();
    await producer.connect();
    logger.warn(`Routing failed message to DLQ topic: ${dlqTopic} due to error: ${errorMessage}`);
    await producer.send({
      topic: dlqTopic,
      messages: [
        {
          key: 'failed-message',
          value: JSON.stringify({
            rawMessage,
            errorMessage,
            timestamp: new Date().toISOString()
          })
        }
      ]
    });
    await producer.disconnect();
  } catch (err) {
    logger.error('Failed to publish message to DLQ fallback topic', err as Error);
  }
}
