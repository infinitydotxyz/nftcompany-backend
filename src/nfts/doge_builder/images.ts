import { readdirSync, writeFileSync, readFileSync, Dirent } from 'fs';
import { UploadResponse, File } from '@google-cloud/storage';
import { Doge, Bows, Hearts, Hats, Backgrounds, Glasses, Stars, Diamonds, Lasers, Crowns } from './dogeImages';
import { combineImages } from './imageMaker';
import streamBuffers from 'stream-buffers';
import Canvas from 'canvas';
const { loadImage } = Canvas;
const { Readable } = require('stream');
import { generateDoge2048NftMetadata, DogeMetadata, getDoge2048NftLevelId } from '../metadataUtils';
import { NftMetadata } from '../types/NftMetadata';

const utils = require('../../../utils');
const firebaseAdmin = utils.getFirebaseAdmin();
const constants = require('../../constants');
const fstrCnstnts = constants.firestore;
const db = firebaseAdmin.firestore();
const bucket = firebaseAdmin.storage().bucket();
const kStartDir = './src/nfts/doge_builder/images';

const imageCache = new Map<string, Canvas.Image>();

export const uploadSourceImages = async () => {
  const result: Map<string, string[]> = new Map();

  await uploadDirectory(kStartDir, result);

  const jsonString = JSON.stringify(mapToObj(result), null, 2);

  writeFileSync('./images.json', jsonString);

  await uploadString(jsonString, 'images/doge/images.json');
};

export const metadataForDoge2048Nft = async (
  chainId: string,
  tokenAddress: string,
  tokenId: number,
  score: number,
  numPlays: number,
  dogBalance: number
): Promise<NftMetadata> => {
  // check if already generated
  const tokenAddr = tokenAddress.trim().toLowerCase();
  const levelId = getDoge2048NftLevelId(score, numPlays, dogBalance);
  let levelIdExists = false;
  let levelValues = new DogeMetadata();

  const docId = utils.getAssetDocId({ chainId, tokenId: String(tokenId), tokenAddress });
  console.log('docid', docId);
  const assetDocRef = db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.ASSETS_COLL)
    .doc(docId);

  const assetDoc = await assetDocRef.get();

  if (assetDoc.exists) {
    const data = assetDoc.data();
    const gameData = data.metadata?.gameData as DogeMetadata;
    if (gameData) {
      const lvlId = gameData.levelId;
      if (lvlId === levelId) {
        levelIdExists = true;
        levelValues.levelId = lvlId;
        levelValues.eyeTrait = gameData.eyeTrait;
        levelValues.eyeTraitValue = gameData.eyeTraitValue;
        levelValues.headTrait = gameData.headTrait;
        levelValues.headTraitValue = gameData.headTraitValue;
        levelValues.neckTrait = gameData.neckTrait;
        levelValues.neckTraitValue = gameData.neckTraitValue;
        levelValues.background = gameData.background;
        levelValues.backgroundTraitValue = gameData.backgroundTraitValue;
      }
    }
  }

  let dogeMetadata: DogeMetadata = null;
  if (levelIdExists) {
    dogeMetadata = levelValues;
    dogeMetadata.chainId = chainId;
    dogeMetadata.tokenId = tokenId;
    dogeMetadata.tokenAddress = tokenAddress;
  } else {
    dogeMetadata = generateDoge2048NftMetadata(chainId, tokenAddr, tokenId, score, numPlays, dogBalance);
    // store in firestore
    const obj = {
      metadata: {
        // vagaries of firestore
        gameData: JSON.parse(JSON.stringify(dogeMetadata))
      }
    };
    assetDocRef
      .set(obj, { merge: true })
      .catch((err: any) => utils.error('Error storing doge 2048 metadata for', chainId, tokenAddr, tokenId, err));
  }
  const eyesAttribute = {
    trait_type: dogeMetadata.eyeTrait,
    value: dogeMetadata.eyeTraitValue
  };
  const headAttribute = {
    trait_type: dogeMetadata.headTrait,
    value: dogeMetadata.headTraitValue
  };
  const neckAttribute = {
    trait_type: dogeMetadata.neckTrait,
    value: dogeMetadata.neckTraitValue
  };
  const backgroundAttribute = {
    trait_type: dogeMetadata.background,
    value: dogeMetadata.backgroundTraitValue
  };

  const path = `images/polygon/doge2048/${dogeMetadata.hash()}.jpg`;
  const remoteFile: File = bucket.file(path);
  const existsArray = await remoteFile.exists();
  if (existsArray && existsArray.length > 0 && !existsArray[0]) {
    const buffer = await buildImage(dogeMetadata);
    await uploadImage(buffer, path);
  }

  const image = remoteFile.publicUrl();
  const attributes = [eyesAttribute, headAttribute, neckAttribute, backgroundAttribute];
  return { image, attributes };
};

// =================================================
// private

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
          imagePath = Backgrounds.swirl;
          break;
        case 'Purple':
          imagePath = Backgrounds.purple;
          break;
        case 'Green':
          imagePath = Backgrounds.green;
          break;
        case 'Orange':
          imagePath = Backgrounds.gradient; // no orange?
          break;
        case 'Pink Stripes':
          imagePath = Backgrounds.pink;
          break;
        case 'Blue Stripes':
          imagePath = Backgrounds.blue;
          break;
        case 'Moon':
          imagePath = Backgrounds.stars; // no moon?
          break;
        case 'Nyan':
          imagePath = Backgrounds.rainbow; // no nylan?
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
          imagePath = Backgrounds.nightclub;
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
    console.log(`Background: Not handled: ${metadata.background}, ${metadata.backgroundTraitValue}`);
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
        case 'Black':
          imagePath = Glasses.blackShades;
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
    case 'Money Glasses':
      switch (metadata.eyeTraitValue) {
        case 'Gold':
          imagePath = Glasses.goldMoneyShades;
          break;
        case 'Purple':
          imagePath = Glasses.purpleMoneyShades;
          break;
        case 'Green':
          imagePath = Glasses.greenMoneyShades;
          break;
        case 'Silver':
          imagePath = Glasses.silverMoneyShades;
          break;
      }
      break;
    case 'Diamond Eyes':
      switch (metadata.eyeTraitValue) {
        case 'Blue':
          imagePath = Diamonds.blueDiamonds;
          break;
        case 'Green':
          imagePath = Diamonds.greenDiamonds;
          break;
        case 'Pink':
          imagePath = Diamonds.pinkDiamonds;
          break;
        case 'Purple':
          imagePath = Diamonds.purpleDiamonds;
          break;
        case 'White':
          imagePath = Diamonds.whiteDiamonds;
          break;
        case 'Gold':
          imagePath = Diamonds.yellowGoldDiamonds;
          break;
      }
      break;
    case 'Laser Eyes':
      switch (metadata.eyeTraitValue) {
        case 'Red':
          imagePath = Lasers.redLasers;
          break;
        case 'Green':
          imagePath = Lasers.greenLasers;
          break;
        case 'Blue':
          imagePath = Lasers.blueLasers;
          break;
        case 'Purple':
          imagePath = Lasers.purplelasers;
          break;
      }
      break;
    case 'Monacle':
      switch (metadata.eyeTraitValue) {
        case 'Monacle':
          imagePath = Glasses.monocle;
          break;
      }
      break;
  }
  if (imagePath) {
    file = await bucket.file(imagePath);
    image = await downloadImage(file);
    images.push(image);
  } else {
    console.log(`Eyes: Not handled: ${metadata.eyeTrait}, ${metadata.eyeTraitValue}`);
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
    case 'ETH':
      switch (metadata.headTraitValue) {
        case 'Purple':
          imagePath = Hats.purpleEthCap;
          break;
        case 'Green':
          imagePath = Hats.greenEthCap;
          break;
      }
      break;
    case 'Top Hat':
      switch (metadata.headTraitValue) {
        case 'Green':
          imagePath = Hats.greenTophat;
          break;
        case 'Black':
          imagePath = Hats.blackTophat;
          break;
        case 'Purple':
          imagePath = Hats.purpleTophat;
          break;

        case 'Gold':
          imagePath = Hats.goldTophat;
          break;
        case 'Brown':
          imagePath = Hats.brownTophat;
          break;
        default:
          break;
      }
      break;
    case 'Items':
      switch (metadata.headTraitValue) {
        case 'BTC':
          imagePath = Hats.btcCap;
          break;
        case 'SOL':
          imagePath = Hats.solCap;
          break;
        case 'Blue Diamond':
          imagePath = Hats.diamondCap;
          break;
        case 'Fire Emoji':
          imagePath = Hats.fireCap;
          break;

        case 'Crown':
          imagePath = Hats.crownCap;
          break;
        case 'Rocker':
          imagePath = Hats.rocketCap;
          break;
        case 'Heart':
          imagePath = Hats.heartCap;
          break;
      }
      break;

    case 'Regular':
      switch (metadata.headTraitValue) {
        case 'Cyan':
          imagePath = Hats.cyancap;
          break;
        case 'Yellow':
          imagePath = Hats.yellowCap;
          break;
        case 'White':
          imagePath = Hats.whiteCap;
          break;
        case 'Red':
          imagePath = Hats.redCap;
          break;
        case 'Blue':
          imagePath = Hats.blueCap;
          break;
        case 'Pink':
          imagePath = Hats.pinkPartyHat;
          break;
      }
      break;

    case 'Flower Crown':
      switch (metadata.headTraitValue) {
        case 'Blue':
          imagePath = Crowns.blueFlowerCrown;
          break;
        case 'Yellow':
          imagePath = Crowns.yellowFlowerCrown;
          break;
        case 'White':
          imagePath = Crowns.whiteFlowerCrown;
          break;
        case 'Red':
          imagePath = Crowns.redFlowerCrown;
          break;
        case 'Purple':
          imagePath = Crowns.purpleFlowerCrown;
          break;
        case 'Pink':
          imagePath = Crowns.pinkFlowerCrown;
          break;
      }
      break;

    case 'Halo & Wings':
      switch (metadata.headTraitValue) {
        case 'Silver':
          imagePath = Crowns.silverWings;
          break;
        case 'Gold':
          imagePath = Crowns.goldWings;
          break;
      }
      break;

    case 'Crown & Sceptor':
      switch (metadata.headTraitValue) {
        case 'Silver':
          imagePath = Crowns.silverCrown;
          break;
        case 'Gold':
          imagePath = Crowns.goldCrown;
          break;
        case 'Bronze':
          imagePath = Crowns.bronzeCrown;
          break;
      }
      break;
  }

  if (imagePath) {
    file = await bucket.file(imagePath);
    image = await downloadImage(file);
    images.push(image);
  } else {
    console.log(`Head: Not handled: ${metadata.headTrait}, ${metadata.headTraitValue}`);
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
        console.log(`Neck: Not handled: ${metadata.neckTrait}, ${metadata.neckTraitValue}`);
      }
      break;
  }

  const buffer = await combineImages({ images });

  return buffer;
};

const uploadImage = async (buffer: Buffer, path: string): Promise<File> => {
  return uploadBuffer(buffer, path, 'image/jpeg');
};

const uploadString = async (str: string, path: string): Promise<File> => {
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
        const destination = `images/doge2048${relativePath}${f.name}`;
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

const uploadBuffer = async (buffer: Buffer, path: string, contentType: string): Promise<File> => {
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
            console.log(`uploaded: ${remoteFile.name}`);

            resolve(remoteFile);
          })
      );
    });
  }

  return remoteFile;
};
