import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { Router } from 'express';
import path from 'path';

const router = Router();

const apiDir = path.join(process.cwd(), './dist/src/routes/**/*.js');
console.log(apiDir);
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Infinity API',
      version: '1.0.0'
    },
    servers: [{ url: 'https://api.infinity.xyz' }]
  },
  apis: [apiDir] // files containing annotations as above
};

const openapiSpecification = swaggerJsdoc(options);

router.use('/', swaggerUi.serve, swaggerUi.setup(openapiSpecification));

export default router;
