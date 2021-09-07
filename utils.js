const firebaseAdmin = require('firebase-admin')

//todo: change this before push
var serviceAccount = require("/tmp/nftc-web-firebase-creds.json")
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount)
})

// firebaseAdmin.initializeApp({
//   credential: firebaseAdmin.credential.applicationDefault()
// })

let DEBUG_LOG = true //todo: change this
if (process.env.DEBUG_LOG == 'false') {
  DEBUG_LOG = false
}

let ERROR_LOG = true
if (process.env.ERROR_LOG == 'false') {
  ERROR_LOG = false
}

module.exports = {

  getFirebaseAdmin: function() {
    return firebaseAdmin
  },

  log: function (obj, ...objs) {
    if (DEBUG_LOG) {
      let msg = ""
      for (const s of objs) {
        msg += ' ' + s
      }
      console.log('[INFO]: ' + obj + msg)
    }
  },

  error: function (obj, ...objs) {
    if (ERROR_LOG) {
      let msg = ""
      for (const s of objs) {
        msg += ' ' + s
      }
      console.error('[ERROR]: ' + obj + msg)
    }
  },

  jsonString: function (obj) {
    return JSON.stringify(obj, null, 2)
  },

  authorizeUser: async function (path, token) {
    // path is in the form /users/userId/*
    let userId = path.split("/")[2]
    let checkRevoked = false //todo: see if this needs to be set to true
    let authenticated = false
    try {
      //this.log("Authorizing " + userId + " for " + path)
      let result = await firebaseAdmin.auth().verifyIdToken(token, checkRevoked)
      if (result.uid == userId) {
        authenticated = true
      }
    } catch (error) {
      if (error.code == 'auth/id-token-revoked') {
        // Token has been revoked. Inform the user to reauthenticate or signOut() the user.
        this.error("Token is revoked. Please ask user to sign out.", error)
      } else {
        // Token is invalid.
        this.error("Token is invalid. Please ask user to sign in again.", error)
      }
    }
    return authenticated
  },

  roundToDecimals: function (num, precision) {
    return Number(Math.round(num + "e+" + precision) + "e-" + precision)
  }
}