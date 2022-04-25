export const InfinityFeeTreasuryABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_infinityExchange',
        type: 'address'
      },
      {
        internalType: 'address',
        name: '_stakerContract',
        type: 'address'
      },
      {
        internalType: 'address',
        name: '_creatorFeeManager',
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
        internalType: 'address',
        name: 'manager',
        type: 'address'
      }
    ],
    name: 'CollectorFeeManagerUpdated',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'address',
        name: 'manager',
        type: 'address'
      }
    ],
    name: 'CreatorFeeManagerUpdated',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'user',
        type: 'address'
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'currency',
        type: 'address'
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256'
      }
    ],
    name: 'CreatorFeesClaimed',
    type: 'event'
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
    name: 'CuratorFeeUpdated',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'user',
        type: 'address'
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'currency',
        type: 'address'
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256'
      }
    ],
    name: 'CuratorFeesClaimed',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'enum StakeLevel',
        name: 'level',
        type: 'uint8'
      },
      {
        indexed: false,
        internalType: 'uint16',
        name: 'newBps',
        type: 'uint16'
      }
    ],
    name: 'EffectiveFeeBpsUpdated',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'address',
        name: 'collection',
        type: 'address'
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'currency',
        type: 'address'
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'totalFees',
        type: 'uint256'
      }
    ],
    name: 'FeeAllocated',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'address',
        name: 'currency',
        type: 'address'
      },
      {
        indexed: false,
        internalType: 'bytes32',
        name: 'oldMerkleRoot',
        type: 'bytes32'
      },
      {
        indexed: false,
        internalType: 'bytes32',
        name: 'newMerkleRoot',
        type: 'bytes32'
      }
    ],
    name: 'MerkelRootUpdated',
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
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'address',
        name: 'stakingContract',
        type: 'address'
      }
    ],
    name: 'StakerContractUpdated',
    type: 'event'
  },
  {
    stateMutability: 'payable',
    type: 'fallback'
  },
  {
    inputs: [],
    name: 'BRONZE_EFFECTIVE_FEE_BPS',
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
    name: 'CREATOR_FEE_MANAGER',
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
    name: 'CURATOR_FEE_BPS',
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
    name: 'GOLD_EFFECTIVE_FEE_BPS',
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
    name: 'INFINITY_EXCHANGE',
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
    name: 'PLATINUM_EFFECTIVE_FEE_BPS',
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
    name: 'SILVER_EFFECTIVE_FEE_BPS',
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
    name: 'STAKER_CONTRACT',
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
    inputs: [
      {
        internalType: 'address',
        name: 'seller',
        type: 'address'
      },
      {
        internalType: 'address',
        name: 'buyer',
        type: 'address'
      },
      {
        components: [
          {
            internalType: 'address',
            name: 'collection',
            type: 'address'
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'tokenId',
                type: 'uint256'
              },
              {
                internalType: 'uint256',
                name: 'numTokens',
                type: 'uint256'
              }
            ],
            internalType: 'struct OrderTypes.TokenInfo[]',
            name: 'tokens',
            type: 'tuple[]'
          }
        ],
        internalType: 'struct OrderTypes.OrderItem[]',
        name: 'items',
        type: 'tuple[]'
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256'
      },
      {
        internalType: 'address',
        name: 'currency',
        type: 'address'
      },
      {
        internalType: 'uint256',
        name: 'minBpsToSeller',
        type: 'uint256'
      },
      {
        internalType: 'address',
        name: 'execComplication',
        type: 'address'
      },
      {
        internalType: 'bool',
        name: 'feeDiscountEnabled',
        type: 'bool'
      }
    ],
    name: 'allocateFees',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'currency',
        type: 'address'
      }
    ],
    name: 'claimCreatorFees',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'currency',
        type: 'address'
      },
      {
        internalType: 'uint256',
        name: 'cumulativeAmount',
        type: 'uint256'
      },
      {
        internalType: 'bytes32',
        name: 'expectedMerkleRoot',
        type: 'bytes32'
      },
      {
        internalType: 'bytes32[]',
        name: 'merkleProof',
        type: 'bytes32[]'
      }
    ],
    name: 'claimCuratorFees',
    outputs: [],
    stateMutability: 'nonpayable',
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
        name: '',
        type: 'address'
      }
    ],
    name: 'creatorFees',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256'
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
        name: '',
        type: 'address'
      }
    ],
    name: 'cumulativeClaimed',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256'
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
      }
    ],
    name: 'curatorFees',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'user',
        type: 'address'
      }
    ],
    name: 'getEffectiveFeeBps',
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
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address'
      }
    ],
    name: 'merkleRoots',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32'
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
    inputs: [
      {
        internalType: 'uint256',
        name: 'startGas',
        type: 'uint256'
      },
      {
        components: [
          {
            internalType: 'bool',
            name: 'isSellOrder',
            type: 'bool'
          },
          {
            internalType: 'address',
            name: 'signer',
            type: 'address'
          },
          {
            internalType: 'uint256[]',
            name: 'constraints',
            type: 'uint256[]'
          },
          {
            components: [
              {
                internalType: 'address',
                name: 'collection',
                type: 'address'
              },
              {
                components: [
                  {
                    internalType: 'uint256',
                    name: 'tokenId',
                    type: 'uint256'
                  },
                  {
                    internalType: 'uint256',
                    name: 'numTokens',
                    type: 'uint256'
                  }
                ],
                internalType: 'struct OrderTypes.TokenInfo[]',
                name: 'tokens',
                type: 'tuple[]'
              }
            ],
            internalType: 'struct OrderTypes.OrderItem[]',
            name: 'nfts',
            type: 'tuple[]'
          },
          {
            internalType: 'address[]',
            name: 'execParams',
            type: 'address[]'
          },
          {
            internalType: 'bytes',
            name: 'extraParams',
            type: 'bytes'
          },
          {
            internalType: 'bytes',
            name: 'sig',
            type: 'bytes'
          }
        ],
        internalType: 'struct OrderTypes.Order[]',
        name: 'sells',
        type: 'tuple[]'
      },
      {
        internalType: 'address',
        name: 'matchExecutor',
        type: 'address'
      },
      {
        internalType: 'address',
        name: 'weth',
        type: 'address'
      }
    ],
    name: 'refundMatchExecutionGasFee',
    outputs: [],
    stateMutability: 'nonpayable',
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
    inputs: [
      {
        internalType: 'address',
        name: 'destination',
        type: 'address'
      }
    ],
    name: 'rescueETH',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'destination',
        type: 'address'
      },
      {
        internalType: 'address',
        name: 'currency',
        type: 'address'
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256'
      }
    ],
    name: 'rescueTokens',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'currency',
        type: 'address'
      },
      {
        internalType: 'bytes32',
        name: '_merkleRoot',
        type: 'bytes32'
      }
    ],
    name: 'setMerkleRoot',
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
        name: 'manager',
        type: 'address'
      }
    ],
    name: 'updateCreatorFeeManager',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'uint16',
        name: 'bps',
        type: 'uint16'
      }
    ],
    name: 'updateCuratorFees',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'enum StakeLevel',
        name: 'stakeLevel',
        type: 'uint8'
      },
      {
        internalType: 'uint16',
        name: 'bps',
        type: 'uint16'
      }
    ],
    name: 'updateEffectiveFeeBps',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_stakerContract',
        type: 'address'
      }
    ],
    name: 'updateStakingContractAddress',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'bytes32[]',
        name: 'proof',
        type: 'bytes32[]'
      },
      {
        internalType: 'bytes32',
        name: 'root',
        type: 'bytes32'
      },
      {
        internalType: 'bytes32',
        name: 'leaf',
        type: 'bytes32'
      }
    ],
    name: 'verify',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool'
      }
    ],
    stateMutability: 'pure',
    type: 'function'
  },
  {
    stateMutability: 'payable',
    type: 'receive'
  }
];
