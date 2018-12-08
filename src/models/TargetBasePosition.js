'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TargetBasePositionSchema = new Schema({
  data: {
    required: true,
    type: Number,
  },
  pair: {
    type: Map,
    of: String,
    required: true,
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
  collection: 'tbp',
  timestamps: true,
});

mongoose.model('TargetBasePosition', TargetBasePositionSchema);
