import 'dotenv/config';
import app from './src/app.js';
import db from './src/models/index.js';
import './src/config/redis.js'; // initialise Redis connection at startup
import logger from './src/utils/logger.js';

const PORT = process.env.PORT || 3000;

try {
  await db.sequelize.authenticate();
  logger.info('Database connection established.');

  app.listen(PORT, () => {
    logger.info(`Server running at http://localhost:${PORT}`);
    logger.info(`Swagger documentation is running at http://localhost:${PORT}/api-docs`)
  });
} catch (err) {
  logger.error('Failed to start server:', { message: err.message, stack: err.stack });
  process.exit(1);
}
