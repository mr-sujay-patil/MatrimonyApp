import express from 'express';
import { Logger } from '@matrimony/shared-logger';

const app = express();
const logger = new Logger('verification-service');
const port = process.env.PORT || 3009;

app.use(express.json());

app.get('/health', (req, res) => {
  logger.info('Health check triggered');
  res.json({ status: 'UP', service: 'verification-service' });
});

app.listen(port, () => {
  logger.info(`verification Service listening on port ${port}`);
});
export default app;
