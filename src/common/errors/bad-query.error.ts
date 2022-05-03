export class BadQueryError extends Error {
  constructor(message: string) {
    super(message);
  }
}
