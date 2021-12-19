import expressJSDocSwagger from 'express-jsdoc-swagger';
import { Application } from 'express';

export function registerDocs(app: Application) {
  const options = {
    info: {
      version: '1.0.0',
      title: 'Infinity API',
      description: '',
      license: {
        name: 'MIT'
      }
    },
    baseDir: __dirname,
    filesPattern: './**/*.js',
    // URL where SwaggerUI will be rendered
    swaggerUIPath: '/docs',
    // Expose OpenAPI UI
    exposeSwaggerUI: true,
    // multiple option in case you want more that one instance
    multiple: true
  };
  expressJSDocSwagger(app)(options);
}
