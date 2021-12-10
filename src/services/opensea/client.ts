import { openseaParamSerializer } from '@utils/formatters';
import axios from 'axios';

const authKey = process.env.openseaKey;

export const openseaClient = axios.create({
  headers: {
    'X-AUTH-KEY': authKey,
    'X-API-KEY': authKey
  },
  paramsSerializer: openseaParamSerializer
});
