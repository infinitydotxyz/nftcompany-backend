export type FileBlob = {
  fileName: string;
  extension: string;
  data?: Buffer;
  /**
   * Content type a.k.a mime type.
   *
   * For exmaple: `image/png`.
   */
  contentType?: string;
};

export type FileRoot = 'images';

export type SaveFileOptions = Omit<FileBlob, 'fileName' | 'extension'> & { root?: FileRoot };
