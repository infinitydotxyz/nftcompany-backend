import { StringBoolean } from './string-boolean';

export interface EnvironmentVariables {
  firestoreTestRoot: string;
  covalentKey: string;
  unmarshalKey: string;
  alchemyJsonRpcEthMainnet: string;
  openseaKey: string;
  gasPriceApi: string;
  twitterBearerToken: string;
  etherscanApiKey: string;
  icyToolsApiKey: string;
  alchemyNftAPiBaseUrlEth: string;
  alchemyNftAPiBaseUrlPolygon: string;
  TRACE_LOG: StringBoolean;
  INFO_LOG: StringBoolean;
  ERROR_LOG: StringBoolean;
  WARN_LOG: StringBoolean;
}
