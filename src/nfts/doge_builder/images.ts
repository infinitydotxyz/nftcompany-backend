import { readdirSync, Dirent, writeFileSync } from 'fs';
import { UploadResponse, File } from '@google-cloud/storage';
import { Doge, Bows, Hats, Backgrounds, Glasses } from './dogeImages';
import { combineImages } from './imageMaker';
import streamBuffers from 'stream-buffers';
import Canvas from 'canvas';
const { loadImage } = Canvas;
const { Readable } = require('stream');

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
  await bucket.upload('./images.json', { destination });
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

const downloadImage = async (file: File): Promise<Canvas.Image> => {
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

export const testUpload = async (): Promise<string> => {
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

  const buffer = await combineImages({ images: [imageBack, image1, image2, image3, image4] });

  const remoteFile: File = bucket.file('images/polygon/test12.jpg');

  return new Promise((resolve, reject) => {
    Readable.from(buffer).pipe(
      remoteFile
        .createWriteStream({
          metadata: {
            contentType: 'image/jpeg'
          }
        })
        .on('error', (error) => {
          console.log('error', error);

          reject(error);
        })
        .on('finish', () => {
          console.log('done');

          resolve(remoteFile.name);
        })
    );
  });
};
