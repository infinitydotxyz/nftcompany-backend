import { ICY_TOOLS_API_KEY } from '@base/constants';
import axios from 'axios';

export const icyToolsClient = axios.create({
  baseURL: 'https://graphql.icy.tools/graphql',
  headers: {
    'x-api-key': ICY_TOOLS_API_KEY
  }
});
