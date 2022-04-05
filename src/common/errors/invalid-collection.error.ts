export class InvalidCollectionError extends Error {
  constructor(public readonly collectionAddress: string, public readonly collectionChainId: string, reason?: string) {
    super(
      `Invalid collection address: ${collectionAddress} chainId: ${collectionChainId}${
        reason ? ` reason: ${reason}` : ''
      }`
    );
  }
}
