import express from 'express';
import { Logger } from '@matrimony/shared-logger';

const app = express();
const logger = new Logger('subscription-service');
const port = process.env.PORT || 3010;

app.use(express.json());

app.get('/health', (req, res) => {
  logger.info('Health check triggered');
  res.json({ status: 'UP', service: 'subscription-service' });
});

app.listen(port, () => {
  logger.info(`subscription Service listening on port ${port}`);
});
export default app;
