export interface schema {
  query: RootQuery;
}

// A token attribute
interface TokenAttribute {
  // Attribute name
  name: string;

  // Attribute value
  value: string;
}

// A wallet
interface Wallet {
  address: string;
  ensName: string;

  logs: LogConnection;
  // // The log history for this wallet
  // logs
  //   // Returns the items in the list that come after the specified cursor.
  //   after: string

  //   // Returns the first n items from the list.
  //   first: number

  //   // Filters for logs
  //   filter: LogsFilterInputType
  // ): LogConnection

  token: Token;
  // // A token owned by this wallet, if it exists
  // token(
  //   // The address of the contract that the token is under
  //   contractAddress: string!

  //   // The id of the token
  //   tokenId: string!
  // ): Token

  tokens: TokenConnection;
  // // A list of tokens owned by this wallet
  // tokens(
  //   // Returns the items in the list that come after the specified cursor.
  //   after: string

  //   // Returns the first n items from the list.
  //   first: number
  // ): TokenConnection
}

// A connection to a list of items.
interface LogConnection {
  // Information to aid in pagination.
  pageInfo: PageInfo;

  // A list of edges.
  edges: LogEdge[];
}

// Information about pagination in a connection.
interface PageInfo {
  // When paginating forwards, are there more items?
  hasNextPage: boolean;

  // When paginating backwards, are there more items?
  hasPreviousPage: boolean;

  // When paginating backwards, the cursor to continue.
  startCursor: string;

  // When paginating forwards, the cursor to continue.
  endCursor: string;
}

// An edge in a connection.
interface LogEdge {
  // The item at the end of the edge
  node: Log;

  // A cursor for use in pagination
  cursor: string;
}

// input: LogsFilterInputType;
//   // Filter input for logs
//   input LogsFilterInputType {
//     // Filter logs by their block number
//     blockNumber: IntegerInput

//     // Filter logs by contract address
//     contractAddress: StringInput

//     // Filter logs by their estimated confirmation date
//     estimatedConfirmedAt: DateInputType

//     // Filter logs by the "from" wallet
//     fromAddress: StringInput

//     // Filter logs by the "to" wallet
//     toAddress: StringInput

//     // Filter logs by their block number
//     typeIn: [LogType]
//   }

//   input IntegerInput {
//     eq: number
//     lt: number
//     lte: number
//     gt: number
//     gte: number
//     in: [number!]
//   }

//   input StringInput {
//     eq: string
//     in: [string!]
//     notIn: [string!]
//   }

//   input DateInputType {
//     eq: Date
//     lt: Date
//     lte: Date
//     gt: Date
//     gte: Date
//   }

// Date custom scalar type
//   scalar Date

enum LogType {
  MINT = 'MINT',
  ORDER = 'ORDER',
  TRANSFER = 'TRANSFER'
}

// A connection to a list of items.
interface TokenConnection {
  // Information to aid in pagination.
  pageInfo: PageInfo;

  // A list of edges.
  edges: TokenEdge[];
}

// An edge in a connection.
interface TokenEdge {
  // The item at the end of the edge
  node: Token;

  // A cursor for use in pagination
  cursor: string;
}

// A ERC-721 contract
export interface ERC721Contract {
  address: string;
  isVerified: boolean;
  tokenStandard: TokenStandard.ERC721;

  // Statistics related to a token's traits/attributes.
  attributes: ContractAttribute[];

  logs: LogConnection;
  // // The log history for this contract
  // logs(
  //   // Returns the items in the list that come after the specified cursor.
  //   after: string

  //   // Returns the first n items from the list.
  //   first: number

  //   // Filters for logs
  //   filter: LogsFilterInputType
  // ): LogConnection

  token: TokenConnection;
  // // A token under this contract
  // token(
  //   // The id of the token
  //   tokenId: string!
  // ): Token
  // tokens(
  //   // Returns the items in the list that come after the specified cursor.
  //   after: string

  //   // Returns the first n items from the list.
  //   first: number
  // ): TokenConnection

  // The name of the contract
  name: string;

  stats: ContractStats;
  // stats(
  //   // The date range from which to pull stats from. Defaults to last 24 hours.
  //   timeRange: DateInputType
  // ): ContractStats

  // The symbol of the contract
  symbol: string;
}

export enum TokenStandard {
  ERC721 = 'ERC721',
  ERC1155 = 'ERC1155'
}

// A contract's stats for a given timeframe
interface ContractStats {
  // Average price
  average: number;

  // Ceiling price
  ceiling: number;

  // Floor price
  floor: number;

  // Total number of sales
  totalSales: number;

  // Total volume
  volume: number;
}

export interface ERC1155Contract extends BaseContract {
  tokenStandard: TokenStandard.ERC1155;
}

// A base contract
export interface BaseContract {
  address: string;
  isVerified: boolean;
  tokenStandard: TokenStandard;

  // Statistics related to a token's traits/attributes.
  attributes: ContractAttribute[];

  logs: LogConnection;
  // // The log history for this contract
  // logs(
  //   // Returns the items in the list that come after the specified cursor.
  //   after: string

  //   // Returns the first n items from the list.
  //   first: number

  //   // Filters for logs
  //   filter: LogsFilterInputType
  // ): LogConnection

  token: Token;
  // // A token under this contract
  // token(
  //   // The id of the token
  //   tokenId: string!
  // ): Token

  tokens: TokenConnection;
  // tokens(
  //   // Returns the items in the list that come after the specified cursor.
  //   after: string

  //   // Returns the first n items from the list.
  //   first: number
  // ): TokenConnection
}

// A contract

export type Contract = ERC721Contract | ERC1155Contract;

// A contract's attribute count
interface ContractAttribute {
  // The trait key.
  name: string;

  // The `100 * value_count / total_tokens for the contract.
  rarity: number;

  // The value of the trait.
  value: string;

  // The total count for this name: value pair in the contract.
  valueCount: number;
}

// A base log
export interface BaseLog {
  // The block number for this log
  blockNumber: number;

  // The contract address for this log
  contractAddress: string;

  // The estimated time the transaction was confirmed at
  estimatedConfirmedAt: Date;

  // The from address for this log
  fromAddress: string;

  // This log index -- logs are unique by the transaction_hash + log_index
  logIndex: number;

  // The to address for this log
  toAddress: string;

  // The transaction hash for this log
  transactionHash: string;

  // The address of the wallet that created this transaction
  transactionCreator: string;

  // The type of log this is: Order, Mint, Transfer, etc.
  type: LogType;

  // The Contract related to this log
  contract: Contract;

  // The from Wallet related to this log
  from: Wallet;

  // The to Wallet related to this log
  to: Wallet;

  // The Token related to this log
  token: Token;
}

// A log
interface Log {
  // The block number for this log
  blockNumber: number;

  // The contract address for this log
  contractAddress: string;

  // The estimated time the transaction was confirmed at
  estimatedConfirmedAt: Date;

  // The from address for this log
  fromAddress: string;

  // This log index -- logs are unique by the transaction_hash + log_index
  logIndex: number;

  // The to address for this log
  toAddress: string;

  // The transaction hash for this log
  transactionHash: string;

  // The address of the wallet that created this transaction
  transactionCreator: string;

  // The interface of log this is: Order, Mint, Transfer, etc.
  type: LogType;

  // The Contract related to this log
  contract: Contract;

  // The from Wallet related to this log
  from: Wallet;

  // The to Wallet related to this log
  to: Wallet;

  // The Token related to this log
  token: Token;
}

// A Mint log
export interface MintLog {
  // The block number for this log
  blockNumber: number;

  // The contract address for this log
  contractAddress: string;

  // The estimated time the transaction was confirmed at
  estimatedConfirmedAt: Date;

  // The from address for this log
  fromAddress: string;

  // This log index -- logs are unique by the transaction_hash + log_index
  logIndex: number;

  // The to address for this log
  toAddress: string;

  // The transaction hash for this log
  transactionHash: string;

  // The address of the wallet that created this transaction
  transactionCreator: string;

  // The type of log this is: Order, Mint, Transfer, etc.
  type: LogType;

  // The Contract related to this log
  contract: Contract;

  // The from Wallet related to this log
  from: Wallet;

  // The to Wallet related to this log
  to: Wallet;

  // The Token related to this log
  token: Token;
}

// A Order log
export interface OrderLog {
  // The block number for this log
  blockNumber: number;

  // The contract address for this log
  contractAddress: string;

  // The estimated time the transaction was confirmed at
  estimatedConfirmedAt: Date;

  // The from address for this log
  fromAddress: string;

  // This log index -- logs are unique by the transaction_hash + log_index
  logIndex: number;

  // The to address for this log
  toAddress: string;

  // The transaction hash for this log
  transactionHash: string;

  // The address of the wallet that created this transaction
  transactionCreator: string;

  // The type of log this is: Order, Mint, Transfer, etc.
  type: LogType;

  // The Contract related to this log
  contract: Contract;

  // The from Wallet related to this log
  from: Wallet;

  // The to Wallet related to this log
  to: Wallet;

  // The Token related to this log
  token: Token;

  // The marketplace this Order was placed on: OpenSea, Genie, etc.
  marketplace: LogOrderMarketplace;

  // The price paid in Ethereum
  priceInEth: number;
}

enum LogOrderMarketplace {
  CRYPTOPUNKS = 'CRYPTOPUNKS',
  GEM = 'GEM',
  GENIE = 'GENIE',
  LOOKSRARE = 'LOOKSRARE',
  OPENSEA = 'OPENSEA'
}

// A Transfer log
export interface TransferLog {
  // The block number for this log
  blockNumber: number;

  // The contract address for this log
  contractAddress: string;

  // The estimated time the transaction was confirmed at
  estimatedConfirmedAt: Date;

  // The from address for this log
  fromAddress: string;

  // This log index -- logs are unique by the transaction_hash + log_index
  logIndex: number;

  // The to address for this log
  toAddress: string;

  // The transaction hash for this log
  transactionHash: string;

  // The address of the wallet that created this transaction
  transactionCreator: string;

  // The type of log this is: Order, Mint, Transfer, etc.
  type: LogType;

  // The Contract related to this log
  contract: Contract;

  // The from Wallet related to this log
  from: Wallet;

  // The to Wallet related to this log
  to: Wallet;

  // The Token related to this log
  token: Token;
}

// An ERC721 token
export interface ERC721Token {
  tokenId: string;

  // The attributes of the token.
  attributes: TokenAttribute[];

  // The contract standard for the token.
  contract: Contract;

  // An array of image locations and sizes for the token.
  images: TokenImage[];

  logs: LogConnection;
  // // The log history for this token
  // logs(
  //   // Returns the items in the list that come after the specified cursor.
  //   after: string

  //   // Returns the first n items from the list.
  //   first: number

  //   // Filters for logs
  //   filter: LogsFilterInputType
  // ): LogConnection

  name: string;
  ownerAddress: string;
  symbol: string;
  metadata: ERC721Metadata;
  owner: Wallet;
}

// An uploaded token image
interface TokenImage {
  // Height in pixels of token image
  height: number;

  // The mime type of the image
  mimeType: string;

  // CDN served image URLs in various sizes or as SVG
  url: string;

  // Width in pixels of token image
  width: number;
}

// An ERC721 standard metadata. Return any keys matching the ERC721 standard and ignore non-conforming keys.
interface ERC721Metadata {
  animation_url: string;
  attributes: ERC721MetadataAttribute[];
  background_color: string;
  description: string;
  external_url: string;
  image: string;
  image_data: string;
  name: string;
  youtube_url: string;
}

// A Metadata Attribute. Return the attribute keys for the ERC721 standard.
interface ERC721MetadataAttribute {
  display_type: string;
  trait_type: string;
  value: string;
}

// A base token
export interface BaseToken {
  tokenId: string;

  // The attributes of the token.
  attributes: TokenAttribute[];

  // The contract standard for the token.
  contract: Contract;

  // An array of image locations and sizes for the token.
  images: TokenImage[];

  logs: LogConnection;
  // // The log history for this token
  // logs(
  //   // Returns the items in the list that come after the specified cursor.
  //   after: string

  //   // Returns the first n items from the list.
  //   first: number

  //   // Filters for logs
  //   filter: LogsFilterInputType
  // ): LogConnection
}

// A token
interface Token {
  tokenId: string;

  // The attributes of the token.
  attributes: TokenAttribute[];

  // The contract standard for the token.
  contract: Contract;

  // An array of image locations and sizes for the token.
  images: TokenImage[];

  logs: LogConnection;
  // // The log history for this token
  // logs(
  //   // Returns the items in the list that come after the specified cursor.
  //   after: string

  //   // Returns the first n items from the list.
  //   first: number

  //   // Filters for logs
  //   filter: LogsFilterInputType
  // ): LogConnection
}

// The root of all... queries
interface RootQuery {
  contract: Contract;
  // // Fetches a contract
  // contract(
  //   // The address of the contract
  //   address: string
  // ): Contract

  contracts: ContractConnection;
  // // Fetches all contracts with default sorting alphabetically by name
  // contracts(
  //   // Returns the items in the list that come after the specified cursor.
  //   after: string

  //   // Returns the first n items from the list.
  //   first: number
  //   filter: ContractsFilterInput
  //   orderBy: ContractsOrderByEnum

  //   // The direction you want to order results: ASC/DESC
  //   orderDirection: OrderDirectionEnum
  // ): ContractConnection

  logs: LogConnection;
  // // Fetches all logs sorted by descending estimatedConfirmedAt
  // logs(
  //   // Returns the items in the list that come after the specified cursor.
  //   after: string

  //   // Returns the first n items from the list.
  //   first: number

  //   // Filters for logs
  //   filter: LogsFilterInputType
  // ): LogConnection

  token: Token;
  // // Fetches a token
  // token(
  //   // The address of the contract that the token is under
  //   contractAddress: string!

  //   // The id of the token
  //   tokenId: string!
  // ): Token

  wallet: Wallet;
  // // Fetches a wallet. Provide either a wallet address or ensName. The query will use address if both are provided.
  // wallet(
  //   // The address of the wallet
  //   address: string

  //   // A wallet's ENS name
  //   ensName: string
  // ): Wallet
}

// A connection to a list of items.
export interface ContractConnection {
  // Information to aid in pagination.
  pageInfo: PageInfo;

  // A list of edges.
  edges: ContractEdge[];
}

// An edge in a connection.
interface ContractEdge {
  // The item at the end of the edge
  node: Contract;

  // A cursor for use in pagination
  cursor: string;
}

//   // Filters available to the "contracts" query
//   input ContractsFilterInput {
//     // The address of the contract
//     address: StringInput

//     // The name of the contract
//     name: SearchStringInput

//     // The symbol of the contract
//     symbol: SearchStringInput
//   }

//   input SearchStringInput {
//     eq: string
//     startswith: string
//     endswith: string
//     contains: string
//     istartswith: string
//     iendswith: string
//     icontains: string
//   }

export enum ContractsOrderBy {
  /**
   * Sort contracts by average sale price within a given time range. Defaults to within last hour, use timeframe on "stats" to further filter.
   */
  Average = 'AVERAGE',

  /**
   * Sort contracts by max sale price within a given time range. Defaults to within last hour, use timeframe on "stats" to further filter.
   */
  Ceiling = 'CEILING',

  /**
   * Sort contracts by min sale price within a given time range. Defaults to within last hour, use timeframe on "stats" to further filter.
   */
  Floor = 'FLOOR',

  /**
   * Sort contracts alphabetically by name
   */
  Name = 'NAME',

  /**
   * Sort contracts by number of sales. Defaults to within last hour, use timeframe on "stats" to further filter.
   */
  Sales = 'SALES',

  /**
   * Sort contracts alphabetically by symbol
   */
  Symbol = 'SYMBOL',
  /**
   * Sort contracts by volume. Defaults to within last hour, use timeframe on "stats" to further filter.
   */
  Volume = 'VOLUME'
}
