'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const Models = require('../common/models');
const Utils = require('./utils');
class MarketFiltration {
  constructor(_details, _scheduler, _quoter, _broker) {
    this._details = _details;
    this._scheduler = _scheduler;
    this._quoter = _quoter;
    this._broker = _broker;
    this._latest = null;
    this.FilteredMarketChanged = new Utils.Evt();
    this.filterFullMarket = () => {
      const mkt = this._broker.currentBook;
      if (mkt == null || mkt.bids.length < 1 || mkt.asks.length < 1) {
        this.latestFilteredMarket = null;
        return;
      }
      const ask = this.filterMarket(mkt.asks, Models.Side.Ask);
      const bid = this.filterMarket(mkt.bids, Models.Side.Bid);
      this.latestFilteredMarket = new Models.Market(bid, ask, mkt.time);
    };
    this.filterMarket = (mkts, s) => {
      const rgq = this._quoter.quotesSent(s);
      const copiedMkts = [];
      for (var i = 0; i < mkts.length; i++) {
        copiedMkts.push(new Models.MarketSide(mkts[i].price, mkts[i].size));
      }
      for (let j = 0; j < rgq.length; j++) {
        const q = rgq[j].quote;
        for (var i = 0; i < copiedMkts.length; i++) {
          const m = copiedMkts[i];
          if (Math.abs(q.price - m.price) < this._details.minTickIncrement) {
            copiedMkts[i].size = m.size - q.size;
          }
        }
      }
      return copiedMkts.filter(m => m.size > 0.001);
    };
    _broker.MarketData.on(() => this._scheduler.schedule(this.filterFullMarket));
  }
  get latestFilteredMarket() { return this._latest; }
  set latestFilteredMarket(val) {
    this._latest = val;
    this.FilteredMarketChanged.trigger();
  }
}
exports.MarketFiltration = MarketFiltration;
// # sourceMappingURL=market-filtration.js.map
