import express from 'express';
import { Logger } from '@matrimony/shared-logger';

const app = express();
const logger = new Logger('chat-service');
const port = process.env.PORT || 3005;

app.use(express.json());

app.get('/health', (req, res) => {
  logger.info('Health check triggered');
  res.json({ status: 'UP', service: 'chat-service' });
});

app.listen(port, () => {
  logger.info(`chat Service listening on port ${port}`);
});
export default app;
