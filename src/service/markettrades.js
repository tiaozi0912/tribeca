'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const Models = require('../common/models');
const Utils = require('./utils');
const _ = require('lodash');
const moment = require('moment');
const logging_1 = require('./logging');
class MarketTradeBroker {
  constructor(_mdGateway, _marketTradePublisher, _mdBroker, _quoteEngine, _base, _persister, initMkTrades) {
    this._mdGateway = _mdGateway;
    this._marketTradePublisher = _marketTradePublisher;
    this._mdBroker = _mdBroker;
    this._quoteEngine = _quoteEngine;
    this._base = _base;
    this._persister = _persister;
    this._log = logging_1.default('mt:broker');
    this.MarketTrade = new Utils.Evt();
    this._marketTrades = [];
    this.handleNewMarketTrade = u => {
      const qt = u.onStartup ? null : this._quoteEngine.latestQuote;
      const mkt = u.onStartup ? null : this._mdBroker.currentBook;
      const px = Utils.roundNearest(u.price, this._base.minTickIncrement);
      const t = new Models.MarketTrade(this._base.exchange(), this._base.pair, px, u.size, u.time, qt, mkt === null ? null : mkt.bids[0], mkt === null ? null : mkt.asks[0], u.make_side);
      if (u.onStartup) {
        for (const existing of this._marketTrades) {
          try {
            const dt = Math.abs(moment(existing.time).diff(moment(u.time), 'minutes'));
            if (Math.abs(existing.size - u.size) < 1e-4 &&
                            Math.abs(existing.price - u.price) < (0.5 * this._base.minTickIncrement) &&
                            dt < 1) { return; }
          } catch (error) {
            continue;
          }
        }
      }
      while (this.marketTrades.length >= 50) { this.marketTrades.shift(); }
      this.marketTrades.push(t);
      this.MarketTrade.trigger(t);
      this._marketTradePublisher.publish(t);
      this._persister.persist(t);
    };
    initMkTrades.forEach(t => this.marketTrades.push(t));
    this._log.info('loaded %d market trades', this.marketTrades.length);
    _marketTradePublisher.registerSnapshot(() => _.takeRight(this.marketTrades, 50));
    this._mdGateway.MarketTrade.on(this.handleNewMarketTrade);
  }
  get marketTrades() { return this._marketTrades; }
}
exports.MarketTradeBroker = MarketTradeBroker;
// # sourceMappingURL=markettrades.js.map
