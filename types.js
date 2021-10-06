const OrderSide = {
  Buy: 0,
  Sell: 1
};

const RewardTiers = {
  t1: {
    min: 0,
    max: 1000,
    threshold: 50
  },
  t2: {
    min: 1000,
    max: 20000,
    threshold: 1000
  },
  t3: {
    min: 20000,
    max: 100000,
    threshold: 5000
  },
  t4: {
    min: 100000,
    max: 500000,
    threshold: 25000
  },
  t5: {
    min: 500000,
    max: Infinity,
    threshold: 50000
  }
};

module.exports = {
  OrderSide,
  RewardTiers
};
