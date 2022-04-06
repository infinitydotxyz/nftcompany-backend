import { UNMARSHALL_API_KEY } from '../../constants';
import axios from 'axios';

export const unmarshalClient = axios.create({
  baseURL: 'https://api.unmarshal.com/v2/',
  params: {
    auth_key: UNMARSHALL_API_KEY
  }
});
