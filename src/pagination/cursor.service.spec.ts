import { Test, TestingModule } from '@nestjs/testing';
import { CursorService } from './cursor.service';

describe('PaginationService', () => {
  let service: CursorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CursorService]
    }).compile();

    service = module.get<CursorService>(CursorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should encode and decode number cursor', () => {
    const offset = 1;
    const cursor = service.encodeCursor(offset);
    const decoded = service.decodeCursorToNumber(cursor);
    expect(decoded).toBe(offset);
  });

  it('should encode and decode string cursor', () => {
    const data = 'Hello World!';
    const cursor = service.encodeCursor(data);
    const decoded = service.decodeCursor(cursor);
    expect(decoded).toBe(data);
  });

  it('should encode and decode object cursor', () => {
    const obj = { foo: 123, bar: 'abc' };
    const cursor = service.encodeCursor(obj);
    const decoded = service.decodeCursorToObject<{ foo: number; bar: string }>(cursor);
    expect(decoded).toStrictEqual(obj);
  });

  it('should decode empty cursor', () => {
    const decoded = service.decodeCursor('');
    expect(decoded).toBe('');
  });
});
