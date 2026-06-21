import { kafka, kafkaTopic } from '../config/kafka';
import { Story } from './StorySync';
import { Logger } from '@matrimony/shared-logger';

const logger = new Logger('kanban-kafka-producer');

let producer: any = null;

async function getProducer() {
  if (!kafka) return null;
  if (!producer) {
    producer = kafka.producer();
    await producer.connect();
    logger.info('Kafka Producer connected.');
  }
  return producer;
}

export async function publishStoryEvent(
  eventType: 'STORY_CREATED' | 'STORY_UPDATED' | 'STORY_DELETED' | 'STORY_MOVED',
  storyId: string,
  payload: any,
  correlationId: string
) {
  try {
    const activeProducer = await getProducer();
    if (!activeProducer) {
      logger.warn(`Kafka disabled. Skipping event dispatch: ${eventType} for ${storyId}`);
      return;
    }

    const event = {
      eventId: require('crypto').randomUUID(),
      eventType,
      eventVersion: 1,
      timestamp: new Date().toISOString(),
      sourceSystem: 'KANBAN',
      correlationId,
      projectId: '9a26c124-b363-45b6-9358-5c0b0d143422',
      storyId,
      payload
    };

    logger.info(`Publishing event ${eventType} for story ${storyId} to topic ${kafkaTopic}`);
    await activeProducer.send({
      topic: kafkaTopic,
      messages: [
        {
          key: storyId,
          value: JSON.stringify(event)
        }
      ]
    });
  } catch (err) {
    logger.error(`Failed to publish story event ${eventType} for story ${storyId}`, err as Error);
  }
}

export async function detectAndPublishChanges(
  oldStories: Story[],
  newStories: Story[],
  correlationId: string
) {
  const oldMap = new Map<string, Story>();
  oldStories.forEach(s => oldMap.set(s.id, s));

  const newMap = new Map<string, Story>();
  newStories.forEach(s => newMap.set(s.id, s));

  // Check for created or updated/moved stories
  for (const newStory of newStories) {
    const oldStory = oldMap.get(newStory.id);
    if (!oldStory) {
      // STORY_CREATED
      await publishStoryEvent('STORY_CREATED', newStory.id, newStory, correlationId);
    } else {
      // Check if status changed (STORY_MOVED)
      if (oldStory.status !== newStory.status) {
        await publishStoryEvent('STORY_MOVED', newStory.id, {
          fromStatus: oldStory.status,
          toStatus: newStory.status
        }, correlationId);
      } else {
        // Check if other properties updated
        const isDifferent = JSON.stringify(oldStory) !== JSON.stringify(newStory);
        if (isDifferent) {
          await publishStoryEvent('STORY_UPDATED', newStory.id, newStory, correlationId);
        }
      }
    }
  }

  // Check for deleted stories
  for (const oldStory of oldStories) {
    if (!newMap.has(oldStory.id)) {
      await publishStoryEvent('STORY_DELETED', oldStory.id, {
        id: oldStory.id,
        title: oldStory.title
      }, correlationId);
    }
  }
}
