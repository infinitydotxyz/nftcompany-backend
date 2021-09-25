const firebaseAdmin = require('firebase-admin');
const { ethers } = require('ethers');

const serviceAccount = require('./creds/nftc-dev-firebase-creds.json');
firebaseAdmin.initializeApp({
  // @ts-ignore
  credential: firebaseAdmin.credential.cert(serviceAccount)
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
      trace('Authorizing ' + userId + ' for ' + path);
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

  getEndCode: function (searchTerm) {
    // Firebase doesn't have a clean way of doing starts with so this boilerplate code helps prep the query
    const strLength = searchTerm.length;
    const strFrontCode = searchTerm.slice(0, strLength - 1);
    const strEndCode = searchTerm.slice(strLength - 1, searchTerm.length);
    const endCode = strFrontCode + String.fromCharCode(strEndCode.charCodeAt(0) + 1);
    return endCode;
  },

  // get and parse req.query fields, return a map of { fieldName: numberValue,... }
  parseQueryFields: (res, req, fieldArr, defaultValues) => {
    const numberFields = {};
    try {
      fieldArr.forEach((name, idx) => {
        numberFields[name] = parseInt(req.query[name] || defaultValues[idx]);
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
    const propNamesArray = Array.from(propNames);
    const isPropValuesEqual = (subject, target, propNames) => {
      return propNames.every((propName) => subject[propName] === target[propName]);
    };
    return items.filter(
      (item, index, array) =>
        index === array.findIndex((foundItem) => isPropValuesEqual(foundItem, item, propNamesArray))
    );
  }
};
