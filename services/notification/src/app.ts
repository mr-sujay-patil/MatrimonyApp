import express from 'express';
import { Logger } from '@matrimony/shared-logger';

const app = express();
const logger = new Logger('notification-service');
const port = process.env.PORT || 3007;

app.use(express.json());

app.get('/health', (req, res) => {
  logger.info('Health check triggered');
  res.json({ status: 'UP', service: 'notification-service' });
});

app.listen(port, () => {
  logger.info(`notification Service listening on port ${port}`);
});
export default app;
