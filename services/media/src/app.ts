import express from 'express';
import { Logger } from '@matrimony/shared-logger';

const app = express();
const logger = new Logger('media-service');
const port = process.env.PORT || 3008;

app.use(express.json());

app.get('/health', (req, res) => {
  logger.info('Health check triggered');
  res.json({ status: 'UP', service: 'media-service' });
});

app.listen(port, () => {
  logger.info(`media Service listening on port ${port}`);
});
export default app;
