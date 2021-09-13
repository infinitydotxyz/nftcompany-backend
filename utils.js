const firebaseAdmin = require("firebase-admin");
const { ethers } = require("ethers");

//todo: adi change this before push
var serviceAccount = require("/tmp/nftc-web-firebase-creds.json");
// var serviceAccount = require("C:\\Users\\Tyler\\Documents\\nftcompany-backend\\firebase-ty.json")
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount),
});

// firebaseAdmin.initializeApp({
//   credential: firebaseAdmin.credential.applicationDefault()
// })

let DEBUG_LOG = true; //todo: adi change this
if (process.env.DEBUG_LOG == "false") {
  DEBUG_LOG = false;
}

let ERROR_LOG = true;
if (process.env.ERROR_LOG == "false") {
  ERROR_LOG = false;
}

module.exports = {
  getFirebaseAdmin: function () {
    return firebaseAdmin;
  },

  log: function (obj, ...objs) {
    if (DEBUG_LOG) {
      let msg = "";
      for (const s of objs) {
        msg += " " + s;
      }
      console.log("[INFO]: " + obj + msg);
    }
  },

  error: function (obj, ...objs) {
    if (ERROR_LOG) {
      let msg = "";
      for (const s of objs) {
        msg += " " + s;
      }
      console.error("[ERROR]: " + obj + msg);
    }
  },

  jsonString: function (obj) {
    return JSON.stringify(obj, null, 2);
  },

  authorizeUser: async function (path, signature, message) {
    // todo: adi for testing only
    //return true

    // path is in the form /u/user/*
    let userId = path.split("/")[2].trim().toLowerCase();
    try {
      this.log("Authorizing " + userId + " for " + path);
      // verify signature
      const sign = JSON.parse(signature);
      const actualAddress = ethers.utils
        .verifyMessage(message, sign)
        .toLowerCase();
      if (actualAddress == userId) {
        return true;
      }
    } catch (error) {
      this.error("Cannot authorize user " + userId, error);
    }
    return false;
  },

  roundToDecimals: function (num, precision) {
    return Number(Math.round(num + "e+" + precision) + "e-" + precision);
  },

  getEndCode: function (searchTerm) {
    // Firebase doesn't have a clean way of doing starts with so this boilerplate code helps prep the query
    const strLength = searchTerm.length;
    const strFrontCode = searchTerm.slice(0, strLength - 1);
    const strEndCode = searchTerm.slice(strLength - 1, searchTerm.length);
    endCode = strFrontCode + String.fromCharCode(strEndCode.charCodeAt(0) + 1);
    return endCode;
  },
};
