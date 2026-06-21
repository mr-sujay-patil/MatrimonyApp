import express from 'express';
import { Logger } from '@matrimony/shared-logger';

const app = express();
const logger = new Logger('search-service');
const port = process.env.PORT || 3004;

app.use(express.json());

app.get('/health', (req, res) => {
  logger.info('Health check triggered');
  res.json({ status: 'UP', service: 'search-service' });
});

app.listen(port, () => {
  logger.info(`search Service listening on port ${port}`);
});
export default app;
