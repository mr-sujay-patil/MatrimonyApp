import express from 'express';
import { Logger } from '@matrimony/shared-logger';

const app = express();
const logger = new Logger('auth-service');
const port = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (req, res) => {
  logger.info('Health check triggered');
  res.json({ status: 'UP', service: 'auth-service' });
});

app.listen(port, () => {
  logger.info(`Auth Service listening on port ${port}`);
});
export default app;
