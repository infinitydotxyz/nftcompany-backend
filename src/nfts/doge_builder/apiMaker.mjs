import { readFile, writeFileSync } from 'fs';

const toTitleCase = (str) => {
  return str.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
};

// ----------------------------------------------------------

const snakeToCamel = (str) =>
  str.toLowerCase().replace(/([-_][a-z])/g, (group) => group.toUpperCase().replace('-', '').replace('_', ''));

// ----------------------------------------------------------

readFile('./images.json', (err, data) => {
  if (err) throw err;

  const obj = JSON.parse(data.toString());

  const converted = {};
  for (const key of Object.keys(obj)) {
    let cleanKey = key.replaceAll('/', '');
    cleanKey = snakeToCamel(cleanKey.toLowerCase());

    // rebuild value
    const pathObjects = {};

    const paths = obj[key];
    for (const path of paths) {
      // find last /
      let name = path.substr(path.lastIndexOf('/') + 1);

      name = name.replaceAll(' ', '-');
      name = snakeToCamel(name.toLowerCase());
      name = name.substr(0, name.lastIndexOf('.'));

      pathObjects[name] = path;
    }

    converted[cleanKey] = pathObjects;
  }

  let output = '';
  for (const key of Object.keys(converted)) {
    output += `export class ${toTitleCase(key)} {\n`;

    const obj = converted[key];

    for (const k of Object.keys(obj)) {
      output += `static const ${k} = '${obj[k]}'\n`;
    }

    output += '}';
    output += '\n\n';
  }

  writeFileSync('./dogeImages.ts', output);
});
