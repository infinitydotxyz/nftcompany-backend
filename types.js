const OrderSide = {
  Buy: 0,
  Sell: 1
};

const RewardTiers = {
  t1: {
    min: 0,
    max: 1000,
    eligible: 706,
    threshold: 50
  },
  t2: {
    min: 1000,
    max: 20000,
    eligible: 2193,
    threshold: 1000
  },
  t3: {
    min: 20000,
    max: 100000,
    eligible: 6587,
    threshold: 5000
  },
  t4: {
    min: 100000,
    max: 500000,
    eligible: 14386,
    threshold: 25000
  },
  t5: {
    min: 500000,
    max: Infinity,
    eligible: 34180,
    threshold: 50000
  }
};

module.exports = {
  OrderSide,
  RewardTiers
};
