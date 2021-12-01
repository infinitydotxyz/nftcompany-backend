import { readdirSync, Dirent, writeFileSync } from 'fs';
import { UploadResponse, File } from '@google-cloud/storage';
import { Doge, Bows, Hats, Backgrounds, Glasses } from './api';
import { saveFile } from './imageMaker';
import streamBuffers from 'stream-buffers';
import pkg from 'canvas';
const { createCanvas, loadImage } = pkg;

const utils = require('../../../utils');
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

  for (const f of files) {
    if (f.isFile()) {
      const destination = `images/doge${relativePath}${f.name}`;

      const result: UploadResponse = await bucket.upload(`${dir}/${f.name}`, { destination });

      names.push(result[0].name);
    } else {
      await upload(`${dir}/${f.name}`, result);
    }
  }

  result.set(relativePath, names);
};

const downloadImage = async (file: File): Promise<pkg.Image> => {
  var memStream = new streamBuffers.WritableStreamBuffer({
    initialSize: 100 * 1024, // start at 100 kilobytes.
    incrementAmount: 10 * 1024 // grow by 10 kilobytes each time buffer overflows.
  });

  return new Promise((resolve, reject) => {
    const res = file
      .createReadStream()
      .pipe(memStream)
      .on('finish', async () => {
        //  console.log(memStream.size());

        const buffer = memStream.getContents();

        if (buffer) {
          const img = await loadImage(buffer);

          resolve(img);
        }
      });
  });
};

export const testUpload = async () => {
  const doge: File = await bucket.file(Doge.doge);
  const bowtie: File = await bucket.file(Bows.redBow);
  const hat: File = await bucket.file(Hats.blackTopHat);
  const background: File = await bucket.file(Backgrounds.tacos);
  const glasses: File = await bucket.file(Glasses.eyePatch);

  const image1 = await downloadImage(doge);
  const image2 = await downloadImage(bowtie);
  const image3 = await downloadImage(hat);
  const imageBack = await downloadImage(background);
  const image4 = await downloadImage(glasses);

  await saveFile({ outputPath: './duh.png', images: [imageBack, image1, image2, image3, image4] });

  const result: UploadResponse = await bucket.upload('./duh.png', { destination: 'images/polygon/test.png' });

  console.log('upload result');
  console.log(result);
  // const d = await doge.arrayBuffer();
  // const b = await bowtie.arrayBuffer();
};
