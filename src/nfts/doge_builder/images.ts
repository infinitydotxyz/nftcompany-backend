import { readdirSync, Dirent, writeFileSync } from 'fs';
import { UploadResponse } from '@google-cloud/storage';

const utils = require('../../utils');
const firebaseAdmin = utils.getFirebaseAdmin();
const bucket = firebaseAdmin.storage().bucket();
const kStartDir = './src/nfts/images';

const filesInDir = (path: string): Dirent[] => {
  let list = readdirSync(path, { withFileTypes: true });

  list = list.filter((entry) => {
    return entry.isFile;
  });

  return list;
};

const mapToObj = (map: Map<string, string[]>) => {
  return [...map].reduce((acc: any, val) => {
    acc[val[0]] = val[1];
    return acc;
  }, {});
};

export const uploadSourceImages = async () => {
  const result: Map<string, string[]> = new Map();

  await upload(kStartDir, result);

  const jsonString = JSON.stringify(mapToObj(result), null, 2);

  console.log(jsonString);

  writeFileSync('./src/nfts/doge_builder/images.json', jsonString);

  const destination = 'images/doge/images.json';
  const uploadRes = await bucket.upload('./images.json', { destination });

  console.log(uploadRes);
};

const upload = async (dir: string, result: Map<string, string[]>) => {
  const names = [];

  const files = filesInDir(dir);

  let relativePath = dir.replace(kStartDir, '');

  if (relativePath.length > 1) {
    relativePath = `${relativePath}/`;
  } else {
    relativePath = '/';
  }

  // console.log(relativePath);

  for (const f of files) {
    if (f.isFile()) {
      const destination = `images/doge${relativePath}${f.name}`;

      // console.log('destination');
      // console.log(destination);

      const result: UploadResponse = await bucket.upload(`${dir}/${f.name}`, { destination });

      names.push(result[0].name);
    } else {
      await upload(`${dir}/${f.name}`, result);
    }
    console.log(f.name);
  }

  result.set(relativePath, names);
};
