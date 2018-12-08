'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PositionSchema = new Schema({
  baseAmount: { // available base amount
    required: true,
    type: Number,
  },
  quoteAmount: { // available quote amount
    type: Number,
    required: true,
  },
  baseHeldAmount: {
    defaultValue: 0,
    type: Number,
  },
  quoteHeldAmount: {
    defaultValue: 0,
    type: Number,
  },
  pair: {
    type: Map,
    of: String,
    required: true,
  },
  value: {
    required: true,
    type: Number,
  },
  quoteValue: {
    required: true,
    type: Number,
  },
  exchange: {
    type: Number, // 5: Coinbase
    required: true,
  },
  time: {
    required: true,
    type: Date,
  },
}, {
  collection: 'pos',
  timestamps: true,
});

PositionSchema.virtual('baseTotalAmount').get(function() {
  return this.baseAmount + this.baseHeldAmount;
});
PositionSchema.virtual('quoteTotalAmount').get(function() {
  return this.quoteAmount + this.quoteHeldAmount;
});
PositionSchema.virtual('price').get(function() {
  return this.quoteValue / this.value;
});

mongoose.model('Position', PositionSchema);
