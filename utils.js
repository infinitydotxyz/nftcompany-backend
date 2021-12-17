const { ethers } = require('ethers');
const ethProvider = new ethers.providers.JsonRpcProvider(process.env.alchemyJsonRpcEthMainnet);
const polygonProvider = new ethers.providers.JsonRpcProvider(process.env.polygonRpc);

const rateLimit = require('express-rate-limit');
const { uniqBy } = require('lodash');
const qs = require('qs');

const firebaseAdmin = require('firebase-admin');
const serviceAccount = require('./creds/nftc-dev-firebase-creds.json');

firebaseAdmin.initializeApp({
  // @ts-ignore
  credential: firebaseAdmin.credential.cert(serviceAccount),
  storageBucket: 'nftc-dev.appspot.com'
});

Object.defineProperty(global, '__stack', {
  get: function () {
    const orig = Error.prepareStackTrace;
    Error.prepareStackTrace = function (_, stack) {
      return stack;
    };
    const err = new Error();
    // eslint-disable-next-line no-caller
    Error.captureStackTrace(err, arguments.callee);
    const stack = err.stack;
    Error.prepareStackTrace = orig;
    return stack;
  }
});

Object.defineProperty(global, '__line', {
  get: function () {
    // @ts-ignore
    // eslint-disable-next-line no-undef
    return __stack[2].getLineNumber();
  }
});

const TRACE_LOG = process.env.TRACE_LOG === 'true';
const INFO_LOG = process.env.INFO_LOG === 'true';
const ERROR_LOG = process.env.ERROR_LOG === 'true';

function error(obj, ...objs) {
  if (ERROR_LOG) {
    let msg = '';
    for (const s of objs) {
      msg += ' ' + s;
    }
    console.error('[ERROR]: ' + obj + msg);
    if (typeof obj === 'object') {
      if (obj.message) {
        console.log('\nMessage: ' + obj.message);
      }
      if (obj.lineNumber) {
        console.log('Error line number ' + obj.lineNumber);
      }
      if (obj.stack) {
        console.log('\nStacktrace:');
        console.log('====================');
        console.log(obj.stack);
      }
    }
  }
}

function trace(obj, ...objs) {
  if (TRACE_LOG) {
    let msg = '';
    for (const s of objs) {
      msg += ' ' + s;
    }
    console.log('[TRACE]: ' + obj + msg);
  }
}

module.exports = {
  getFirebaseAdmin: function () {
    return firebaseAdmin;
  },

  trace,

  log: function (obj, ...objs) {
    if (INFO_LOG) {
      let msg = '';
      for (const s of objs) {
        msg += ' ' + s;
      }
      console.log('[INFO]: ' + obj + msg);
    }
  },

  error,

  jsonString: function (obj) {
    return JSON.stringify(obj, null, 2);
  },

  authorizeUser: async function (path, signature, message) {
    // todo: adi for testing only
    // return true;

    // path is in the form /u/user/*
    const userId = path.split('/')[2].trim().toLowerCase();
    try {
      // verify signature
      const sign = JSON.parse(signature);
      const actualAddress = ethers.utils.verifyMessage(message, sign).toLowerCase();
      if (actualAddress === userId) {
        return true;
      }
    } catch (err) {
      error('Cannot authorize user ' + userId);
      error(err);
    }
    return false;
  },

  postUserRateLimit: rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 200, // limit each user's address to 200 requests per windowMs
    keyGenerator: function (req, res) {
      // uses user's address as key for rate limiting
      return req.params.user ? req.params.user.trim().toLowerCase() : '';
    }
  }),

  getUserRateLimit: rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 200, // limit each user's address to 200 requests per windowMs
    keyGenerator: function (req, res) {
      // uses user's address as key for rate limiting
      return req.params.user ? req.params.user.trim().toLowerCase() : '';
    }
  }),

  // rate limit for lower frequent calls (setEmail, subscribeEmail, etc.)
  lowRateLimit: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // limit each user's address to 5 requests per windowMs
    keyGenerator: function (req, res) {
      // uses user's address as key for rate limiting
      return req.params.user ? req.params.user.trim().toLowerCase() : '';
    }
  }),

  docsToArray: function (dbDocs) {
    if (!dbDocs) {
      return { results: [], count: 0 };
    }
    const results = [];
    for (const doc of dbDocs) {
      const item = doc.data();
      if (doc.id) {
        item.id = doc.id;
      }
      results.push(item);
    }
    return { results, count: results.length };
  },

  getEndCode: function (searchTerm) {
    // Firebase doesn't have a clean way of doing starts with so this boilerplate code helps prep the query
    const strLength = searchTerm.length;
    const strFrontCode = searchTerm.slice(0, strLength - 1);
    const strEndCode = searchTerm.slice(strLength - 1, searchTerm.length);
    const endCode = strFrontCode + String.fromCharCode(strEndCode.charCodeAt(0) + 1);
    return endCode;
  },

  // get and parseFloat (also validate float) req.query fields, return a map of { fieldName: numberValue,... }
  parseQueryFields: (res, req, fieldArr, defaultValues) => {
    const numberFields = {};
    try {
      fieldArr.forEach((name, idx) => {
        numberFields[name] = parseFloat(req.query[name] || defaultValues[idx]);
        if (isNaN(numberFields[name])) {
          throw Error(`Invalid query param: ${name} = ${req.query[name]}`);
        }
      });
    } catch (err) {
      error('Invalid query params: ' + fieldArr.join(', '));
      error(err);
      res.sendStatus(500);
      return { error: err };
    }
    return numberFields;
  },

  getUniqueItemsByProperties: function (items, propNames) {
    return uniqBy(items, 'address');
  },

  deepCopy: function (item) {
    return JSON.parse(JSON.stringify(item));
  },

  /**
   * @returns the params serialized where arrays are formatted such that the
   * key is repeated for each element of the array (without brackets);
   *
   * e.g. serializing  { key: [value1, value2, value3] } results in
   * ?key=value1&key=value2&key=value3
   */
  openseaParamSerializer: (params) => {
    return qs.stringify(params, { arrayFormat: 'repeat' });
  },

  getFulfilledPromiseSettledResults: (promiseResults) => {
    return promiseResults
      .filter((result) => result.status === 'fulfilled')
      .map((fulfilledResult) => {
        return fulfilledResult.value;
      });
  },

  getSearchFriendlyString: function (input) {
    if (!input) {
      return '';
    }
    // remove spaces, dashes and underscores only
    const output = input.replace(/[\s-_]/g, '');
    return output.toLowerCase();
  },

  getChainProvider: function (chainId) {
    if (chainId === '1') {
      return ethProvider;
    } else if (chainId === '137') {
      return polygonProvider;
    }
    return null;
  },

  getChainId: function (chain) {
    if (chain.trim().toLowerCase() === 'ethereum') {
      return '1';
    } else if (chain.trim().toLowerCase() === 'polygon') {
      return '137';
    }
    return '';
  }
};
