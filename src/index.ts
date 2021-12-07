// import 'tsconfig-paths/register';
import 'reflect-metadata';
import express from 'express';

import helmet from 'helmet';
import cors from 'cors';
import router from '@routes/index.js';
import { log } from '@utils/logger.js';
import { requestErrorHandler } from '@base/middleware/errorHandler.js';
import { requestLogger } from '@base/middleware/logger.js';

// TODO fix redefining global
// import './globals.js';

const app = express();

const registerMiddleware = () => {
  app.use(express.json());
  app.use(cors());
  app.use(helmet());
  app.use(requestLogger);
};

const registerRoutes = () => {
  app.use('/', router);
};

const registerErrorHandler = () => {
  app.use(requestErrorHandler);
};

registerMiddleware();
registerRoutes();
// error handler should be the last middleware registered
registerErrorHandler();

const PORT = process.env.PORT || 9090;
app.listen(PORT, () => {
  log(`Server listening on port ${PORT}...`);
});
