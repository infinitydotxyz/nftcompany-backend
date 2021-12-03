import { readdirSync, readFileSync, Dirent } from 'fs';
import { UploadResponse, File } from '@google-cloud/storage';
import { Doge, Bows, Hearts, Hats, Backgrounds, Glasses, Stars } from './dogeImages';
import { combineImages } from './imageMaker';
import streamBuffers from 'stream-buffers';
import Canvas from 'canvas';
const { loadImage } = Canvas;
const { Readable } = require('stream');
import { generateDoge2048NftMetadata, DogeMetadata } from '../metadataUtils';

const utils = require('../../../utils');
const firebaseAdmin = utils.getFirebaseAdmin();
const bucket = firebaseAdmin.storage().bucket();
const kStartDir = './src/nfts/doge_builder/images';

const imageCache = new Map<string, Canvas.Image>();

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

  await uploadDirectory(kStartDir, result);

  const jsonString = JSON.stringify(mapToObj(result), null, 2);

  await uploadString(jsonString, 'images/doge/images.json');
};

const downloadImage = async (file: File): Promise<Canvas.Image> => {
  // check cache
  let result: Canvas.Image = imageCache.get(file.name);
  if (result != null) {
    return result;
  }

  var memStream = new streamBuffers.WritableStreamBuffer({
    initialSize: 100 * 1024, // start at 100 kilobytes.
    incrementAmount: 10 * 1024 // grow by 10 kilobytes each time buffer overflows.
  });

  return new Promise((resolve, reject) => {
    const res = file
      .createReadStream()
      .pipe(memStream)
      .on('finish', async () => {
        const buffer = memStream.getContents();

        if (buffer) {
          const img = await loadImage(buffer);

          // add to cache
          imageCache.set(file.name, img);

          resolve(img);
        }
      });
  });
};

export const testUpload = async (): Promise<boolean> => {
  const score = 2110;
  const numPlays = 132;
  const dogBalance = 121100;

  return uploadForScore(score, numPlays, dogBalance);
};

export const uploadForScore = async (score: number, numPlays: number, dogBalance: number): Promise<boolean> => {
  const metadata = generateDoge2048NftMetadata(score, numPlays, dogBalance);

  const buffer = await buildImage(metadata);

  const path = `images/polygon/${metadata.hash()}.jpg`;

  const result = await uploadImage(buffer, path);

  return result;
};

const buildImage = async (metadata: DogeMetadata): Promise<Buffer> => {
  const images: Canvas.Image[] = [];
  let file: File;
  let image: Canvas.Image;
  let imagePath: string;

  // ---------------
  // Background
  // ---------------

  imagePath = null;
  switch (metadata.background) {
    case 'Background':
      switch (metadata.backgroundTraitValue) {
        case 'Trippy Swirl':
          imagePath = Backgrounds.trippySwirl;
          break;
        case 'Purple':
          imagePath = Backgrounds.purple;
          break;
        case 'Orange':
          imagePath = Backgrounds.orange;
          break;
        case 'Pink Stripes':
          imagePath = Backgrounds.pinkStripes;
          break;
        case 'Blue Stripes':
          imagePath = Backgrounds.blueStripes;
          break;
        case 'Moon':
          imagePath = Backgrounds.moon;
          break;
        case 'Nyan':
          imagePath = Backgrounds.nyan;
          break;
        case 'Tacos':
          imagePath = Backgrounds.tacos;
          break;
        case 'Pizza':
          imagePath = Backgrounds.pizza;
          break;
        case 'Sushi':
          imagePath = Backgrounds.sushi;
          break;
        case 'Matrix':
          imagePath = Backgrounds.matrix;
          break;
        case 'Night Club':
          imagePath = Backgrounds.nightClub;
          break;
        case 'Clouds':
          imagePath = Backgrounds.clouds;
          break;
        case 'Gold':
          imagePath = Backgrounds.gold;
          break;
      }
      break;
  }

  if (imagePath) {
    file = await bucket.file(imagePath);
    image = await downloadImage(file);
    images.push(image);
  } else {
    console.log(`Not handled: ${metadata.headTrait}, ${metadata.headTraitValue}`);
  }

  // ---------------
  // Doge
  // ---------------

  // doge
  file = await bucket.file(Doge.doge);
  image = await downloadImage(file);
  images.push(image);

  // ---------------
  // Eyes
  // ---------------

  imagePath = null;
  switch (metadata.eyeTrait) {
    case 'Star Eyes':
      switch (metadata.eyeTraitValue) {
        case 'Green':
          imagePath = Stars.greenStars;
          break;
        case 'Pink':
          imagePath = Stars.pinkStars;
          break;
        case 'Blue':
          imagePath = Stars.blueStars;
          break;
        case 'Yellow':
          imagePath = Stars.yellowStars;
          break;
        case 'White':
          imagePath = Stars.whiteStars;
          break;
        case 'Red':
          imagePath = Stars.redStars;
          break;
        case 'Light Purple':
          imagePath = Stars.lightPurpleStars;
          break;
        case 'Purple':
          imagePath = Stars.purpleStars;
          break;
        case 'Cyan':
          imagePath = Stars.cyanStars;
          break;
        case 'Orange':
          imagePath = Stars.orangeStars;
          break;
      }
      break;

    case 'Sunglasses':
      switch (metadata.eyeTraitValue) {
        case 'Green':
          imagePath = Glasses.greenShades;
          break;
        case 'Pink':
          imagePath = Glasses.pinkShades;
          break;
        case 'Dark Blue':
          imagePath = Glasses.darkBlueShades;
          break;
        case 'Yellow':
          imagePath = Glasses.yellowShades;
          break;
        case 'White':
          imagePath = Glasses.whiteShades;
          break;
        case 'Red':
          imagePath = Glasses.redShades;
          break;
        case 'Light Blue':
          imagePath = Glasses.lightBlueShades;
          break;
        case 'Purple':
          imagePath = Glasses.purpleShades;
          break;
        case 'Orange':
          imagePath = Glasses.orangeShades;
          break;
      }
      break;

    case 'Heart Eyes':
      switch (metadata.eyeTraitValue) {
        case 'Green':
          imagePath = Hearts.greenHearts;
          break;
        case 'Pink':
          imagePath = Hearts.pinkHearts;
          break;
        case 'Blue':
          imagePath = Hearts.blueHearts;
          break;
        case 'Yellow':
          imagePath = Hearts.yellowHearts;
          break;
        case 'White':
          imagePath = Hearts.whiteHearts;
          break;
        case 'Red':
          imagePath = Hearts.redHearts;
          break;
        case 'Light Purple':
          imagePath = Hearts.lightPurpleHearts;
          break;
        case 'Purple':
          imagePath = Hearts.purpleHearts;
          break;
        case 'Cyan':
          imagePath = Hearts.cyanHearts;
          break;
        case 'Orange':
          imagePath = Hearts.orangeHearts;
          break;
      }

      break;
  }
  if (imagePath) {
    file = await bucket.file(imagePath);
    image = await downloadImage(file);
    images.push(image);
  } else {
    console.log(`Not handled: ${metadata.eyeTrait}, ${metadata.eyeTraitValue}`);
  }

  // ---------------
  // Head
  // ---------------

  imagePath = null;
  switch (metadata.headTrait) {
    case 'Pirate Hat & Eye Patch':
      file = await bucket.file(Glasses.eyePatch);
      image = await downloadImage(file);
      images.push(image);

      imagePath = Hats.pirateHat;
      break;
    case 'Items':
      switch (metadata.headTraitValue) {
        case 'BTC':
          imagePath = Hats.btcCap;
          break;
        case 'SOL':
          imagePath = Hats.solCap;
          break;
        case 'ETH':
          imagePath = Hats.greenEthCap;
          break;
        case 'Blue Diamond':
          imagePath = Hats.diamondCap;
          break;
        case 'Fire Emoji':
          imagePath = Hats.fireCap;
          break;
      }
      break;
  }

  if (imagePath) {
    file = await bucket.file(imagePath);
    image = await downloadImage(file);
    images.push(image);
  } else {
    console.log(`Not handled: ${metadata.headTrait}, ${metadata.headTraitValue}`);
  }

  // ---------------
  // Neck
  // ---------------

  imagePath = null;
  switch (metadata.neckTrait) {
    case 'Bowtie':
      switch (metadata.neckTraitValue) {
        case 'Gold':
          imagePath = Bows.goldBow;
          break;
        case 'Red':
          imagePath = Bows.redBow;
          break;
        case 'Black':
          imagePath = Bows.blackBow;
          break;
        case 'Blue':
          imagePath = Bows.blueBow;
          break;
        case 'Cyan':
          imagePath = Bows.cyanBow;
          break;
        case 'Green':
          imagePath = Bows.greenBow;
          break;
        case 'Light Purple':
          imagePath = Bows.lightPurpleBow;
          break;
        case 'Purple':
          imagePath = Bows.purpleBow;
          break;
        case 'Orange':
          imagePath = Bows.orangeBow;
          break;
        case 'Pink':
          imagePath = Bows.pinkBow;
          break;
        case 'Pink Checkered':
          imagePath = Bows.pinkCheckeredBow;
          break;
        case 'Rainbow':
          imagePath = Bows.rainbowBow;
          break;
      }

      if (imagePath) {
        file = await bucket.file(imagePath);
        image = await downloadImage(file);
        images.push(image);
      } else {
        console.log(`Not handled: ${metadata.neckTrait}, ${metadata.neckTraitValue}`);
      }
      break;
  }

  const buffer = await combineImages({ images });

  return buffer;
};

const uploadImage = async (buffer: Buffer, path: string): Promise<boolean> => {
  return uploadBuffer(buffer, path, 'image/jpeg');
};

const uploadString = async (str: string, path: string): Promise<boolean> => {
  const buffer = Buffer.from(str, 'utf8');
  buffer.write(str, 'utf8');

  return uploadBuffer(buffer, path, 'application/json');
};

const uploadDirectory = async (dir: string, result: Map<string, string[]>) => {
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
      try {
        const destination = `images/doge${relativePath}${f.name}`;
        const srcPath = `${dir}/${f.name}`;
        const buffer = readFileSync(srcPath);

        await uploadBuffer(buffer, destination, 'image/jpeg');

        names.push(destination);
      } catch (err) {
        console.log(err);
      }
    } else {
      await uploadDirectory(`${dir}/${f.name}`, result);
    }
  }

  result.set(relativePath, names);
};

const uploadBuffer = async (buffer: Buffer, path: string, contentType: string): Promise<boolean> => {
  const remoteFile: File = bucket.file(path);

  // no idea why exists() returns an array [boolean]
  const existsArray = await remoteFile.exists();
  if (existsArray && existsArray.length > 0 && !existsArray[0]) {
    return new Promise((resolve, reject) => {
      Readable.from(buffer).pipe(
        remoteFile
          .createWriteStream({
            metadata: {
              contentType
            }
          })
          .on('error', (error) => {
            console.log('error', error);

            reject(error);
          })
          .on('finish', () => {
            console.log('done');

            resolve(true);
          })
      );
    });
  }

  return false;
};
