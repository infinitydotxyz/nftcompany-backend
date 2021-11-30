const OrderSide = {
  Buy: 0,
  Sell: 1
};

const RewardTiers = {
  t1: {
    min: 0,
    max: 1000,
    eligible: 70,
    threshold: 0.02
  },
  t2: {
    min: 1000,
    max: 20000,
    eligible: 1088,
    threshold: 2
  },
  t3: {
    min: 20000,
    max: 100000,
    eligible: 2636,
    threshold: 5
  },
  t4: {
    min: 100000,
    max: 500000,
    eligible: 7337,
    threshold: 15
  },
  t5: {
    min: 500000,
    max: Infinity,
    eligible: 16678,
    threshold: 30
  }
};

const UsPersonAnswer = {
  yes: 'YES',
  no: 'NO',
  none: 'NONE',
  answeredAt: 0
};

const ListType = {
  FIXED_PRICE: 'fixedPrice',
  DUTCH_AUCTION: 'dutchAuction',
  ENGLISH_AUCTION: 'englishAuction'
};

const StatusCode = {
  OK: 200,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
};

module.exports = {
  StatusCode,
  OrderSide,
  RewardTiers,
  UsPersonAnswer,
  ListType
};
