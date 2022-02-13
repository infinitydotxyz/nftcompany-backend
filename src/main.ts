import 'reflect-metadata';
import './globals';
import express from 'express';

import helmet from 'helmet';
import cors from 'cors';
import router from '@routes/index';
import { log } from '@utils/logger';
import { requestErrorHandler } from '@base/middleware/errorHandler';
import { requestLogger } from '@base/middleware/logger';
import { registerDocs } from './docs';
import { ORIGIN } from '@base/constants';
import { setupDbListeners } from '@utils/dblisteners';

const app = express();

const registerMiddleware = () => {
  app.use(express.json());
  const corsOptions: cors.CorsOptions = {
    origin: ORIGIN,
    optionsSuccessStatus: 200
  };
  app.use(cors(corsOptions));
  app.use(helmet());
  app.use(requestLogger);
};

const registerRoutes = () => {
  app.use('/', router);
};

const registerErrorHandler = () => {
  app.use(requestErrorHandler);
};

registerDocs(app);
registerMiddleware();
registerRoutes();
// error handler should be the last middleware registered
registerErrorHandler();

setupDbListeners();

const PORT = process.env.PORT ?? 9090;
app.listen(PORT, () => {
  log(`Server listening on port ${PORT}...`);
});
