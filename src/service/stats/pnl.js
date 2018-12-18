'use strict';

const mongoose = require('mongoose');
const { initDB } = require('../../init-db');
const { readFromCSV } = require('../utils');
const debug = require('debug')('tribeca:pnl');
const math = require('mathjs');
const uuid1 = require('uuid/v1');

initDB();
const Trade = mongoose.model('Trade');
// const TargetBasePosition = mongoose.model('TargetBasePosition');
const Position = mongoose.model('Position');

const exchange = 5; // Coinbase
const BID_SIDE = 0;
const ASK_SIDE = 1;
// const time = {
//   $gt: new Date('2018-12-02T13:00:00+0800'),
//   $lt: new Date('2018-12-08T13:00:00+0800'),
// };
// const time = {
//   $gt: new Date('2018-12-08T13:00:00+0800'),
//   $lt: new Date('2018-12-11T00:00:00+0800'),
// };
// const time = {
//   $gt: new Date('2018-12-11T00:00:00+0800'),
//   $lt: new Date('2018-12-13T00:00:00+0800'),
// };
// const time = {
//   $gt: new Date('2018-12-13T00:00:00+0800'),
//   $lt: new Date('2018-12-17T00:00:00+0800'),
// };
const time = {
  $gt: new Date('2018-12-17T15:00:00+0800'),
};

const newTradeFromCoinbaseData = d => {
  const sideToCodeMapping = {
    BUY: 0,
    SELL: 1,
  };
  return {
    tradeId: uuid1(),
    side: sideToCodeMapping[d.side],
    exchange,
    pair: {
      base: 1, quote: 0,
    },
    price: Number(d.price),
    quantity: Number(d.size),
    value: Math.abs(Number(d.total)),
    time: new Date(d['created at']),
    liquidity: 0,
    feeCharged: Number(d.fee),
  };
};

const compare = async () => {
  const sideMapping = [ 'BUY', 'SELL' ];
  const filePath = '/Users/yujunwu/Downloads/fills.csv';
  const data = await readFromCSV(filePath);
  const trades = await Trade.find({
    exchange, time,
  }).sort('time');
  // const index = 85;
  // data.splice(index, 1);
  for (let i = 0; trades[i]; i++) {
    const d = data[i];
    const trade = trades[i];
    if (
      sideMapping[trade.side] !== d.side ||
      trade.quantity !== Number(d.size)
    ) {
      debug('Not the same:', i);
      debug('data:', d);

      // create data:
      const newTradeData = newTradeFromCoinbaseData(d);
      await Trade.create(newTradeData);
      // debug('newTradeData:', newTradeData);
      // debug('trade:', trade);
      break;
    }
  }
  console.log('done');
};

const calPNLFromPositions = async () => {
  const positions = await Position.find({
    exchange, time,
  }).sort('time');
  const initPos = positions[0];
  const pos = positions[positions.length - 1];

  const extraBasePosition = pos.baseTotalAmount - initPos.baseTotalAmount;
  // debug('curr price:', pos.price);
  // debug('delta base position:', pos.baseTotalAmount - initPos.baseTotalAmount);
  // debug('delta quote position:', pos.quoteTotalAmount - initPos.quoteTotalAmount);

  const PNL = pos.quoteTotalAmount - initPos.quoteTotalAmount + pos.price * extraBasePosition;

  debug(`PNL computed from positions: $${math.round(PNL, 1)}`);
};

const calPNLFromTrades = async () => {
  const sides = [{ code: BID_SIDE, name: 'buy' }, { code: ASK_SIDE, name: 'sell' }];
  const pos = await Position.findOne({
    exchange, time,
  }).sort('-time');

  for (const side of sides) {
    const trades = await Trade.find({
      exchange,
      side: side.code,
      time,
    }).sort('-time');

    debug(`${side.name} trades count:`, trades.length);

    // Compute avg price, total size and value
    side.sumValue = math.add.apply(null, trades.map(t => t.value));
    side.sumQuantity = math.add.apply(null, trades.map(t => t.quantity));
    side.avgPx = side.sumValue / side.sumQuantity;

    // debug(`${side.name} trades data:`, { sumValue: side.sumValue, sumQuantity: side.sumQuantity, avgPx: side.avgPx });
  }

  // from trades
  debug('--- from trades:');
  // debug('curr price:', pos.price);
  const deltaQuote = sides[1].sumValue - sides[0].sumValue;
  const deltaBase = sides[0].sumQuantity - sides[1].sumQuantity;
  // debug('delta base position:', deltaBase);
  // debug('delta quote position:', deltaQuote);
  debug('PNL computed from trades:', deltaQuote + deltaBase * pos.price);

  const hedgedQuantity = math.min(sides[0].sumQuantity, sides[1].sumQuantity);
  const hedgedPNL = (sides[1].avgPx - sides[0].avgPx) * hedgedQuantity;
  const hedgedValue = math.abs(hedgedQuantity) * (sides[0].avgPx + sides[1].avgPx);

  // After hedge
  let sideWithExtra;
  for (const side of sides) {
    if (side.sumQuantity === hedgedQuantity) {
      side.sumValue = 0;
      side.sumQuantity = 0;
    } else {
      sideWithExtra = side;
      side.sumQuantity -= hedgedQuantity;
      side.sumValue -= hedgedQuantity * side.avgPx;
      debug(`Hedged ${side.name} trades data:`, { sumValue: side.sumValue, sumQuantity: side.sumQuantity, avgPx: side.avgPx });
    }
  }

  // 计算头寸，考虑卖了多余的btc或者买进缺少了的btc
  // if 0, buy more, pnl = price - px
  // if 1, sell more, pnl = px - price
  const alpha = [ -1, 1 ][ sideWithExtra.code ];
  const unrealizedPNL = alpha * (sideWithExtra.avgPx - pos.price) * sideWithExtra.sumQuantity;

  debug(`Trade volume: $${math.round(hedgedValue, 1)}`);
  debug(`Realized PNL computed from: $${math.round(hedgedPNL, 1)}`);
  debug(`Unrealized PNL computed from trades: $${math.round(unrealizedPNL, 1)}`);
};

Promise.all([
  // compare(),
  calPNLFromPositions(),
  calPNLFromTrades(),
])
  .then(() => debug('done'))
  .catch(err => debug('err:', err));
