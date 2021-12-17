/**
 * a jsdoc plugin that creates jsdoc comments for typescript interfaces and type definitions
 *
 */
const path = require('path');
const ts = require('typescript');
const fs = require('fs');

const typeConverter = require('./type-converter');

const getDirName = require('path').dirname;
const config = require('./config.json');

function writeFile(path, contents) {
  fs.mkdirSync(getDirName(path), { recursive: true });
  fs.writeFileSync(path, contents);
}

exports.handlers = {
  newDoclet: function ({ doclet }) {
    if (doclet.tags && doclet.tags.length > 0) {
      const categoryTag = doclet.tags.find((tag) => tag.title === 'optional');
      if (categoryTag) {
        doclet.optional = true;
      }
    }
  },

  beforeParse: function (e) {
    if (['.ts', '.tsx'].includes(path.extname(e.filename))) {
      // adding const a = 1 ensures that the comments always will be copied,
      // even when there is no javascript inside (just interfaces)
      const result = ts.transpileModule('const _____a = 1; \n' + e.source, {
        compilerOptions: {
          // @ts-ignore
          target: 'esnext',
          esModuleInterop: true,
          // @ts-ignore
          jsx: path.extname(e.filename) === '.tsx' ? 'react' : null
        }
      });

      const types = typeConverter(e.source, e.filename);
      const src = result.outputText;
      const res = src + '\n' + types;
      console.log(res);
      writeFile(config.outfile, types);
      e.source = res;
    }
  }
};
