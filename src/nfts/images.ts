import { readdirSync, Dirent } from 'fs';

const utils = require('../../utils');
const constants = require('../../constants');
const firebaseAdmin = utils.getFirebaseAdmin();
const bucket = firebaseAdmin.storage().bucket();
const kStartDir = './src/nfts/images';

// upload(kStartDir);

const filesInDir = (path: string): Dirent[] => {
  let list = readdirSync(path, { withFileTypes: true });

  list = list.filter((entry) => {
    return entry.isFile;
  });

  return list;
};

export const uploadSourceImages = async () => {
  upload(kStartDir);
};

const upload = async (dir: string) => {
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

      const result = await bucket.upload(`${dir}/${f.name}`, { destination });
      console.log(result);
    } else {
      upload(`${dir}/${f.name}`);
    }
    console.log(f.name);
  }
};
