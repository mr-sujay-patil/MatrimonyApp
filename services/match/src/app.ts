import express from 'express';
import { Logger } from '@matrimony/shared-logger';

const app = express();
const logger = new Logger('match-service');
const port = process.env.PORT || 3003;

app.use(express.json());

app.get('/health', (req, res) => {
  logger.info('Health check triggered');
  res.json({ status: 'UP', service: 'match-service' });
});

app.listen(port, () => {
  logger.info(`match Service listening on port ${port}`);
});
export default app;
