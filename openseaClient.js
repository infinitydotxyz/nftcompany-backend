require('dotenv').config();
const axios = require('axios').default;

const apiBase = 'https://api.opensea.io/api/v1/collections/';
const authKey = process.env.openseaKey;
const limit = 1;
const offset = 0;
const url = apiBase + '?limit=' + limit + '&offset=' + offset;
const options = {
  headers: {
    'X-API-KEY': authKey
  }
};

axios
  .get(url, options)
  .then((resp) => {
    console.log(JSON.stringify(resp.data, null, 2));
  })
  .catch((err) => {
    console.log(err);
  });
