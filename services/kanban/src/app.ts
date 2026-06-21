import express from 'express';
import { Logger } from '@matrimony/shared-logger';
import { readProjectFiles, writeProjectFiles } from './services/StorySync';
import { detectAndPublishChanges } from './services/KafkaProducer';
import { startConsumer } from './services/KafkaConsumer';

const app = express();
app.use(express.json());

const logger = new Logger('kanban-board-service');
const port = process.env.PORT || 3009;

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'kanban-board-service' });
});

// GET /api/projects (STORY-050)
app.get('/api/projects', (req, res, next) => {
  try {
    const project = readProjectFiles();
    res.status(200).json({
      id: project.id,
      name: project.name,
      description: project.description,
      ownerId: project.ownerId,
      version: project.version,
      columns: project.columns,
      stories: project.stories
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/save-file (STORY-050 / STORY-051)
app.post('/api/projects/save-file', async (req, res, next) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || require('crypto').randomUUID();
  try {
    const newBoardPayload = req.body;
    if (!newBoardPayload || !Array.isArray(newBoardPayload.stories)) {
      res.status(400).json({ success: false, error: 'Invalid payload structure. stories array required.' });
      return;
    }

    // 1. Read current state from disk
    const oldProject = readProjectFiles();

    // 2. Perform old vs. new difference & publish story events to Kafka
    await detectAndPublishChanges(oldProject.stories, newBoardPayload.stories, correlationId);

    // 3. Serialize back to disk
    writeProjectFiles(newBoardPayload.stories, oldProject.rawBacklog);

    res.status(200).json({
      success: true,
      message: 'Project and backlog changes successfully saved to disk and Kafka synchronization triggered.',
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(err.message || 'Internal Error', err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'An unexpected error occurred.'
  });
});

app.listen(port, () => {
  logger.info(`Kanban Board Sync Service listening on port ${port}`);
  
  // Start Kafka consumer group (STORY-052)
  startConsumer();
});

export default app;
