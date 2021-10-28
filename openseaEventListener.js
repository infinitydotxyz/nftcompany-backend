require('dotenv').config();
const { ethers } = require('ethers');
const ethersProvider = new ethers.providers.WebSocketProvider(process.env.alchemyJsonRpcEthMainnet);
const BigNumber = require('bignumber.js');

const utils = require('./utils');

const constants = require('./constants');

const openseaAbi = require('./abi/openseaExchangeContract.json');
const openseaContract = new ethers.Contract(constants.WYVERN_EXCHANGE_ADDRESS, openseaAbi, ethersProvider);

function toFixed5(num) {
  // @ts-ignore
  return +BigNumber(num).toFixed(5);
}

module.exports = {
  async init() {
    utils.log('Listening to opensea events');
    openseaContract.on('OrdersMatched', async (buyHash, sellHash, maker, taker, price, metadata) => {
      maker = maker.trim().toLowerCase();
      taker = taker.trim().toLowerCase();
      const priceInEth = ethers.utils.formatEther(price);
      const priceInEthNumeric = toFixed5(priceInEth);

      utils.log(maker, taker, priceInEth, priceInEthNumeric);
    });

    openseaContract.on('OrderCancelled', async (hash) => {
      utils.log(hash);
    });
  }
};
