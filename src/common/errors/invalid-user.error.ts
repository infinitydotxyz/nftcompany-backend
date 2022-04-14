export class InvalidUserError extends Error {
  constructor(public readonly userAddress: string, public readonly userChainid: string, reason?: string) {
    super(
      `Invalid collection address: ${userAddress} chainId: ${userChainid}${
        reason ? ` reason: ${reason}` : ''
      }`
    );
  }
}
