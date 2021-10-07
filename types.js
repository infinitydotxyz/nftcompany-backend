const OrderSide = {
  Buy: 0,
  Sell: 1
};

const RewardTiers = {
  t1: {
    min: 0,
    max: 1000,
    eligible: 706,
    threshold: 0.02
  },
  t2: {
    min: 1000,
    max: 20000,
    eligible: 2193,
    threshold: 0.5
  },
  t3: {
    min: 20000,
    max: 100000,
    eligible: 6587,
    threshold: 2
  },
  t4: {
    min: 100000,
    max: 500000,
    eligible: 14386,
    threshold: 10
  },
  t5: {
    min: 500000,
    max: Infinity,
    eligible: 34180,
    threshold: 20
  }
};

module.exports = {
  OrderSide,
  RewardTiers
};
