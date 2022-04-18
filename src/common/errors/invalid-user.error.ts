export class InvalidUserError extends Error {
  constructor(public readonly userAddress: string, reason?: string) {
    super(`Invalid collection address: ${userAddress} ${reason ? ` reason: ${reason}` : ''}`);
  }
}
