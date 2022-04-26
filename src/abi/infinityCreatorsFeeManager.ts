export const InfinityCreatorsFeeManagerABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_royaltyEngine',
        type: 'address'
      },
      {
        internalType: 'address',
        name: '_creatorsFeeRegistry',
        type: 'address'
      }
    ],
    stateMutability: 'nonpayable',
    type: 'constructor'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint16',
        name: 'newBps',
        type: 'uint16'
      }
    ],
    name: 'NewMaxBPS',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'address',
        name: 'newEngine',
        type: 'address'
      }
    ],
    name: 'NewRoyaltyEngine',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'previousOwner',
        type: 'address'
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'newOwner',
        type: 'address'
      }
    ],
    name: 'OwnershipTransferred',
    type: 'event'
  },
  {
    inputs: [],
    name: 'CREATORS_FEE_REGISTRY',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'MAX_CREATOR_FEE_BPS',
    outputs: [
      {
        internalType: 'uint16',
        name: '',
        type: 'uint16'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'PARTY_NAME',
    outputs: [
      {
        internalType: 'enum FeeParty',
        name: '',
        type: 'uint8'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address'
      },
      {
        internalType: 'address',
        name: 'collection',
        type: 'address'
      },
      {
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256'
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256'
      }
    ],
    name: 'calcFeesAndGetRecipients',
    outputs: [
      {
        internalType: 'enum FeeParty',
        name: '',
        type: 'uint8'
      },
      {
        internalType: 'address[]',
        name: '',
        type: 'address[]'
      },
      {
        internalType: 'uint256[]',
        name: '',
        type: 'uint256[]'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'collection',
        type: 'address'
      },
      {
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256'
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256'
      }
    ],
    name: 'getCreatorsFeeInfo',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address'
      },
      {
        internalType: 'address[]',
        name: '',
        type: 'address[]'
      },
      {
        internalType: 'uint16[]',
        name: '',
        type: 'uint16[]'
      },
      {
        internalType: 'uint256[]',
        name: '',
        type: 'uint256[]'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'royaltyEngine',
    outputs: [
      {
        internalType: 'contract IRoyaltyEngine',
        name: '',
        type: 'address'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'uint16',
        name: '_maxBps',
        type: 'uint16'
      }
    ],
    name: 'setMaxCreatorFeeBps',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'collection',
        type: 'address'
      },
      {
        internalType: 'address[]',
        name: 'feeDestinations',
        type: 'address[]'
      },
      {
        internalType: 'uint16[]',
        name: 'bpsSplits',
        type: 'uint16[]'
      }
    ],
    name: 'setupCollectionForCreatorFeeShare',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'newOwner',
        type: 'address'
      }
    ],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_royaltyEngine',
        type: 'address'
      }
    ],
    name: 'updateRoyaltyEngine',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];
