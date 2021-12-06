import express from 'express';

import helmet from 'helmet';
import cors from 'cors';
import { router } from './routes';

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());

app.use('/', router);

const PORT = process.env.PORT || 9090;

app.listen(PORT, () => {
  //   utils.log(`Server listening on port ${PORT}...`);
});
