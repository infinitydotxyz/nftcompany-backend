/* eslint-disable @typescript-eslint/ban-types */
import { Injectable } from '@nestjs/common';
import { base64Decode, base64Encode } from 'utils';

@Injectable()
export class CursorService {
  /**
   * Encodes a plaintext cursor.
   * @param cursor plaintext cursor
   * @returns base64 encoded cursor
   */
  encodeCursor(cursor: string | number | Object) {
    if (typeof cursor == 'object') {
      cursor = JSON.stringify(cursor);
    }

    return base64Encode(cursor.toString());
  }

  /**
   * Decodes a base64 encoded cursor.
   * @param encoded base64 encoded cursor
   * @returns plaintext
   */
  decodeCursor(encoded: string): string {
    return base64Decode(encoded);
  }

  /**
   * Decodes a base64 encoded JSON cursor to an object.
   * @param encoded
   * @returns
   */
  decodeCursorToObject<T>(encoded: string): T {
    try {
      const decoded = this.decodeCursor(encoded);
      return JSON.parse(decoded);
    } catch (err: any) {
      return {} as T;
    }
  }

  /**
   * Decodes a base64 encoded cursor containing a number to a number.
   * @param encoded
   * @returns
   */
  decodeCursorToNumber(encoded: string) {
    const decoded = this.decodeCursor(encoded);
    return Number(decoded);
  }
}
