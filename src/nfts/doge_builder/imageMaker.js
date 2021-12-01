import { writeFileSync } from 'fs';
import pkg from 'canvas';
const { createCanvas } = pkg;

const canvas = createCanvas(800, 800);
const ctx = canvas.getContext('2d');

export const saveFile = async ({ outputPath, images }) => {
  try {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 800, 800);

    for (const image of images) {
      ctx.drawImage(image, 0, 0);
    }

    let buffer = canvas.toBuffer('image/jpeg', { quality: 0.3 });
    writeFileSync(outputPath, buffer);
    buffer = null;
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};
