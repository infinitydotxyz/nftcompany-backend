import axios from 'axios';

const authKey = process.env.unmarshalKey;
export const unmarshalClient = axios.create({
  baseURL: 'https://api.unmarshal.com/v1/',
  params: {
    auth_key: authKey
  }
});
