/* eslint-disable camelcase */
/* eslint-disable no-unused-vars */
// this doc outlines the high level data structure of firestore
/*

1. collections
    |__1:0x05844e9ae606f9867ae2047c93cac370d54ab2e1 <chainId:collectionAddress in lowercase>
       |__{data}
       |__nfts
          |__1559 <tokenId>
             |__{data}

2. feed
    |__1:AAbghuuiIU <chainId:firestore uuid>
       |__{data}

3. users
    |__1:0xc844c8e1207b9d3c54878c849a431301ba9c23e0 <chainId:userAddress in lowercase>
       |__{data}
       |__collection-follows
          |__1:0x05844e9ae606f9867ae2047c93cac370d54ab2e1 <chainId:collectionAddress in lowercase>
             |__{data}
       |__user-follows
          |__1:0xc844c8e1207b9d3c54878c849a431301ba9c23e0 <chainId:userAddress in lowercase>
             |__{data}

4. sales
    |__1:AAbghuuiIU <chainId:firestore uuid>
       |__{data}


5. listings
    |__dceafaaghiuyt <hash(chainId:collectionAddress:tokenId)>
       |__{data}
       |__valid-active
          |__AAbghuuiIU <firestore uuid>
             |__{data}
       |__valid-inactive
          |__AAbghuuiIU <firestore uuid>
             |__{data}
       |__invalid
          |__AAbghuuiIU <firestore uuid>
             |__{data}

6. offers
    |__dceafaaghiuyt <hash(chainId:collectionAddress:tokenId)>
       |__{data}
       |__valid-active
          |__AAbghuuiIU <firestore uuid>
             |__{data}
       |__valid-inactive
          |__AAbghuuiIU <firestore uuid>
             |__{data}
       |__invalid
          |__AAbghuuiIU <firestore uuid>
             |__{data}

7. collection-stats
    |__1:0x05844e9ae606f9867ae2047c93cac370d54ab2e1 <chainId:collectionAddress>
       |__{data}
       |__hourly
          |__hh-dd-mm-yyyy
             |__{data}
       |__daily
          |__dd-mm-yyyy
             |__{data}
       |__monthly
          |__mm-yyyy
             |__{data}
       |__yearly
          |__yyyy
             |__{data}

8. nft-stats
    |__dceafaaghiuyt <hash(chainId:collectionAddress:tokenId)>
       |__{data}
    

*/

// ================================================== UNUSED OLD DATA STRUCTURES =================================================
// the following data structures won't be used anymore
// outlining them here for reference
/* old data structures not detailed here are:
    - allCollections
    - collectionListings
    - combinedOpenseaSnapshot
    - featuredCollections
    - polygon
*/

// collection containing data about airdropoors
// has_subcollections: false
const airdropStats = {
  // docId is <userAddress in lowercase>
  // example
  '0x0000000000f485a774ee60343ad3ac6d05d95fba': {
    // data
  }
};

// collection containing various data in subcollections
// has a placeholder doc called `info` that holds subcollections
// has_subcollections: true
/*  
    subcollections:
      - users; see `const root__info__users`
      - assets; not referenced here
      - bonusRewardTokens; not referenced here
      - verifiedTokens; not referenced here
*/
const root = {
  info: {
    // no data
  }
};

// collection containing user specific data in various subcollections
// has_subcollections: true
/*  
    subcollections:
      - listings; see `const root__info__users__docId__listings`
      - offers; see `const root__info__users__docId__offers`
      - purchases; not referenced here
      - sales; not referenced here
      - txns; not referenced here
      - missedTxns; not referenced here
*/
const root__info__users = {
  // docId is <userAddress in lowercase>
  // example
  '0xc844c8e1207b9d3c54878c849a431301ba9c23e0': {
    // data
  }
};

// collection containing listings made by a user
// has_subcollections: false
const root__info__users__docId__listings = {
  /* docId is calculated like so:
    const data = tokenAddress.trim() + tokenId.trim() + basePrice;
    return crypto.createHash('sha256').update(data).digest('hex').trim().toLowerCase();
  */
  // example
  '2c9de144715f244cd7ab8025323e1e1f8882381c01f974c4d6a2964cb4d44b9e': {
    // data
  }
};

// collection containing offers made by a user as well as those received by a user
// has_subcollections: false
const root__info__users__docId__offers = {
  /* docId is calculated like so:
    const data = tokenAddress.trim() + tokenId.trim() + basePrice;
    return crypto.createHash('sha256').update(data).digest('hex').trim().toLowerCase();
  */
  // example
  'f23cf0c2c54a5eb75719c4b997e1e4fef46164974f41a5c45f004d106fcea7b1': {
    // data
  }
};
