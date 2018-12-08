'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TradeSchema = new Schema({
  tradeId: {
    required: true,
    index: true,
    type: String,
  },
  exchange: {
    type: Number, // 5: Coinbase
    required: true,
  },
  pair: {
    type: Map,
    of: String,
    required: true,
  },
  price: {
    required: true,
    type: Number,
  },
  quantity: {
    required: true,
    type: Number,
  },
  value: {
    required: true,
    type: Number,
  },
  liquidity: {
    required: true,
    type: Number, // 0 maker, 1: taker
  },
  side: {
    required: true,
    type: Number, // 0 , 1
  },
  feeCharged: {
    defaultValue: 0,
    type: Number,
  },
  time: {
    required: true,
    type: Date,
  },
}, {
  timestamps: true,
});

mongoose.model('Trade', TradeSchema);
