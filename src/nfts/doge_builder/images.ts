import { readdirSync, Dirent, writeFileSync } from 'fs';
import { UploadResponse, File } from '@google-cloud/storage';
import { Doge, Bows, Hearts, Hats, Backgrounds, Glasses } from './dogeImages';
import { combineImages } from './imageMaker';
import streamBuffers from 'stream-buffers';
import Canvas from 'canvas';
const { loadImage } = Canvas;
const { Readable } = require('stream');
import { generateDoge2048NftMetadata, DogeMetadata } from '../metadataUtils';

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
  const score = 2200;
  const numPlays = 122;
  const dogBalance = 100000;

  const metadata = generateDoge2048NftMetadata(score, numPlays, dogBalance);

  const buffer = await buildImage(metadata);
  const result = await uploadImage(buffer, 'images/polygon/test12.jpg');

  return result;
};

const buildImage = async (metadata: DogeMetadata): Promise<Buffer> => {
  console.log(metadata);
  const images: Canvas.Image[] = [];
  let file: File;
  let image: Canvas.Image;

  // background
  file = await bucket.file(Backgrounds.trippySwirl);
  image = await downloadImage(file);
  images.push(image);

  // doge
  file = await bucket.file(Doge.doge);
  image = await downloadImage(file);
  images.push(image);

  switch (metadata.eyeTrait) {
    case 'Heart Eyes':
      switch (metadata.eyeTraitValue) {
        case 'Green':
          file = await bucket.file(Hearts.greenHearts);
          image = await downloadImage(file);
          images.push(image);
          break;
        case 'Blue':
          file = await bucket.file(Hearts.blueHearts);
          image = await downloadImage(file);
          images.push(image);
          break;
      }
      break;
  }

  switch (metadata.headTrait) {
    case 'Items':
      switch (metadata.headTraitValue) {
        case 'BTC':
          file = await bucket.file(Hats.btcCap);
          image = await downloadImage(file);
          images.push(image);
          break;
        case 'SOL':
          file = await bucket.file(Hats.solCap);
          image = await downloadImage(file);
          images.push(image);
          break;
        case 'ETH':
          file = await bucket.file(Hats.greenEthCap);
          image = await downloadImage(file);
          images.push(image);
          break;
      }
      break;
  }

  switch (metadata.neckTrait) {
    case 'Bowtie':
      switch (metadata.neckTraitValue) {
        case 'Gold':
          file = await bucket.file(Bows.goldBow);
          image = await downloadImage(file);
          images.push(image);
          break;
      }
      break;
  }

  const buffer = await combineImages({ images });

  return buffer;
};

const uploadImage = async (buffer: Buffer, path: string): Promise<string> => {
  const remoteFile: File = bucket.file(path);

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
