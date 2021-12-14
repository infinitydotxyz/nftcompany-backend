import Canvas from 'canvas';
const { createCanvas } = Canvas;

const canvas = createCanvas(800, 800);
const ctx = canvas.getContext('2d');

interface Props {
  images: Canvas.Image[];
}

export const combineImages = async ({ images }: Props): Promise<Buffer | undefined> => {
  try {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 800, 800);

    for (const image of images) {
      ctx.drawImage(image, 0, 0);
    }

    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.3 });

    return buffer;
  } catch (err) {
    console.log(err);
  }
};
