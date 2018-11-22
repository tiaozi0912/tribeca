'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const Models = require('../common/models');
const Utils = require('./utils');
const moment = require('moment');
const _ = require('lodash');
class SafetyCalculator {
  constructor(_timeProvider, _repo, _broker, _qlParams, _publisher, _persister) {
    this._timeProvider = _timeProvider;
    this._repo = _repo;
    this._broker = _broker;
    this._qlParams = _qlParams;
    this._publisher = _publisher;
    this._persister = _persister;
    this.NewValue = new Utils.Evt();
    this._latest = null;
    this._buys = [];
    this._sells = [];
    this.onTrade = ut => {
      const u = _.cloneDeep(ut);
      if (this.isOlderThan(u, this._repo.latest)) { return; }
      if (u.side === Models.Side.Ask) {
        this._sells.push(u);
      } else if (u.side === Models.Side.Bid) {
        this._buys.push(u);
      }
      this.computeQtyLimit();
    };
    this.computeQtyLimit = () => {
      const settings = this._repo.latest;
      let buyPing = 0;
      let sellPong = 0;
      let buyPq = 0;
      let sellPq = 0;
      let _buyPq = 0;
      let _sellPq = 0;
      for (let ti = this._broker._trades.length - 1; ti > -1; ti--) {
        if (this._broker._trades[ti].side == Models.Side.Bid && buyPq < settings.size) {
          _buyPq = Math.min(settings.size - buyPq, this._broker._trades[ti].quantity);
          buyPing += this._broker._trades[ti].price * _buyPq;
          buyPq += _buyPq;
        }
        if (this._broker._trades[ti].side == Models.Side.Ask && sellPq < settings.size) {
          _sellPq = Math.min(settings.size - sellPq, this._broker._trades[ti].quantity);
          sellPong += this._broker._trades[ti].price * _sellPq;
          sellPq += _sellPq;
        }
        if (buyPq >= settings.size && sellPq >= settings.size) { break; }
      }
      if (buyPq) { buyPing /= buyPq; }
      if (sellPq) { sellPong /= sellPq; }
      const orderTrades = (input, direction) => {
        return _.chain(input)
          .filter(o => !this.isOlderThan(o, settings))
          .sortBy(t => direction * t.price)
          .value();
      };
      this._buys = orderTrades(this._buys, -1);
      this._sells = orderTrades(this._sells, 1);
      while (_.size(this._buys) > 0 && _.size(this._sells) > 0) {
        const sell = _.last(this._sells);
        const buy = _.last(this._buys);
        if (sell.price >= buy.price) {
          const sellQty = sell.quantity;
          const buyQty = buy.quantity;
          buy.quantity -= sellQty;
          sell.quantity -= buyQty;
          if (buy.quantity < 1e-4) { this._buys.pop(); }
          if (sell.quantity < 1e-4) { this._sells.pop(); }
        } else {
          break;
        }
      }
      const computeSafety = t => t.reduce((sum, t) => sum + t.quantity, 0) / this._qlParams.latest.size;
      this.latest = new Models.TradeSafety(computeSafety(this._buys), computeSafety(this._sells), computeSafety(this._buys.concat(this._sells)), buyPing, sellPong, this._timeProvider.utcNow());
    };
    _publisher.registerSnapshot(() => [ this.latest ]);
    _repo.NewParameters.on(_ => this.computeQtyLimit());
    _qlParams.NewParameters.on(_ => this.computeQtyLimit());
    _broker.Trade.on(this.onTrade);
    _timeProvider.setInterval(this.computeQtyLimit, moment.duration(1, 'seconds'));
  }
  get latest() { return this._latest; }
  set latest(val) {
    if (!this._latest || Math.abs(val.combined - this._latest.combined) > 1e-3
            || Math.abs(val.buyPing - this._latest.buyPing) >= 1e-2
            || Math.abs(val.sellPong - this._latest.sellPong) >= 1e-2) {
      this._latest = val;
      this.NewValue.trigger(this.latest);
      this._persister.persist(this.latest);
      this._publisher.publish(this.latest);
    }
  }
  isOlderThan(o, settings) {
    const now = this._timeProvider.utcNow();
    return Math.abs(Utils.fastDiff(now, o.time)) > (1000 * settings.tradeRateSeconds);
  }
}
exports.SafetyCalculator = SafetyCalculator;
// # sourceMappingURL=safety.js.map
