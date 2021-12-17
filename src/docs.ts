import expressJSDocSwagger from 'express-jsdoc-swagger';
import { Application } from 'express';

export function registerDocs(app: Application) {
  const options = {
    info: {
      version: '1.0.0',
      title: 'Infinity API',
      license: {
        name: 'MIT'
      }
    },
    baseDir: __dirname,
    // Glob pattern to find your jsdoc files (multiple patterns can be added in an array)
    filesPattern: './**/*.js',
    // URL where SwaggerUI will be rendered
    swaggerUIPath: '/docs',
    // Expose OpenAPI UI
    exposeSwaggerUI: true,
    // Expose Open API JSON Docs documentation in `apiDocsPath` path.
    exposeApiDocs: false,
    // Open API JSON Docs endpoint.
    apiDocsPath: '/v3/docs',
    // Set non-required fields as nullable by default
    notRequiredAsNullable: false,
    // You can customize your UI options.
    // you can extend swagger-ui-express config. You can checkout an example of this
    // in the `example/configuration/swaggerOptions.js`
    swaggerUiOptions: {},
    // multiple option in case you want more that one instance
    multiple: true,

    components: {
      schemas: {
        User: {
          properties: {
            id: {
              type: 'integer'
            },
            name: {
              type: 'string'
            }
          }
        }
      }
    }
  };
  expressJSDocSwagger(app)(options);
}
