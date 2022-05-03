export class InvalidTokenError extends Error {
  constructor(
    public readonly collectionAddress: string,
    public readonly collectionChainId: string,
    public readonly tokenId: string,
    reason?: string
  ) {
    super(
      `Invalid token: ${collectionAddress} chainId: ${collectionChainId} TokenId: ${tokenId} ${
        reason ? ` reason: ${reason}` : ''
      }`
    );
  }
}
