import { Test, TestingModule } from '@nestjs/testing';
import { PaginationService } from './pagination.service';

describe('PaginationService', () => {
  let service: PaginationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaginationService]
    }).compile();

    service = module.get<PaginationService>(PaginationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should encode and decode number cursor', () => {
    const offset = 1;
    const cursor = service.encodeCursor(offset);
    const decoded = service.decodeCursor<number>(cursor);
    expect(decoded).toBe(offset);
  });

  it('should encode and decode string cursor', () => {
    const data = 'Hello World!';
    const cursor = service.encodeCursor(data);
    const decoded = service.decodeCursor<string>(cursor);
    expect(decoded).toBe(data);
  });

  it('should encode and decode object cursor', () => {
    const obj = { foo: 123, bar: 'abc' };
    const cursor = service.encodeCursor(obj);
    const decoded = service.decodeCursor<{ foo: number; bar: string }>(cursor);
    expect(decoded).toStrictEqual(obj);
  });

  it('should decode empty cursor', () => {
    const decoded = service.decodeCursor<number>('');
    expect(decoded).toBe(0);
  });
});
