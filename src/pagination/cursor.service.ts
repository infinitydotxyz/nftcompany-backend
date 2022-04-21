/* eslint-disable @typescript-eslint/ban-types */
import { Injectable } from '@nestjs/common';
import { base64Decode, base64Encode } from 'utils';

/**
 * Pagination service.
 *
 * Supported types of pagination:
 * - cursor
 */
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
  decodeCursor<T extends string | number | object>(encoded: string): T {
    const decoded = base64Decode(encoded);

    if (decoded.startsWith('[') || decoded.startsWith('{')) {
      try {
        return JSON.parse(decoded) as T;
      } catch (err: any) {
        return {} as T;
      }
    } else if (!isNaN(Number(decoded))) {
      return Number(decoded) as T;
    } else {
      return decoded as T;
    }
  }
}
