import express from 'express';
import { Logger } from '@matrimony/shared-logger';

const app = express();
const logger = new Logger('recommendation-service');
const port = process.env.PORT || 3006;

app.use(express.json());

app.get('/health', (req, res) => {
  logger.info('Health check triggered');
  res.json({ status: 'UP', service: 'recommendation-service' });
});

app.listen(port, () => {
  logger.info(`recommendation Service listening on port ${port}`);
});
export default app;
