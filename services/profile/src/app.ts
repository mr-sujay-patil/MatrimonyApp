import express from 'express';
import { Logger } from '@matrimony/shared-logger';

const app = express();
const logger = new Logger('profile-service');
const port = process.env.PORT || 3002;

app.use(express.json());

app.get('/health', (req, res) => {
  logger.info('Health check triggered');
  res.json({ status: 'UP', service: 'profile-service' });
});

app.listen(port, () => {
  logger.info(`profile Service listening on port ${port}`);
});
export default app;
