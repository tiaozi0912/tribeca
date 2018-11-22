'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const Models = require('../common/models');
const Utils = require('./utils');
class FairValueEngine {
  constructor(_details, _timeProvider, _filtration, _qlParamRepo, _fvPublisher, _fvPersister) {
    this._details = _details;
    this._timeProvider = _timeProvider;
    this._filtration = _filtration;
    this._qlParamRepo = _qlParamRepo;
    this._fvPublisher = _fvPublisher;
    this._fvPersister = _fvPersister;
    this.FairValueChanged = new Utils.Evt();
    this._latest = null;
    this.recalcFairValue = t => {
      const mkt = this._filtration.latestFilteredMarket;
      if (mkt == null) {
        this.latestFairValue = null;
        return;
      }
      const bid = mkt.bids;
      const ask = mkt.asks;
      if (ask.length < 1 || bid.length < 1) {
        this.latestFairValue = null;
        return;
      }
      const fv = new Models.FairValue(this.ComputeFV(ask[0], bid[0], this._qlParamRepo.latest.fvModel), t);
      this.latestFairValue = fv;
    };
    _qlParamRepo.NewParameters.on(() => this.recalcFairValue(_timeProvider.utcNow()));
    _filtration.FilteredMarketChanged.on(() => this.recalcFairValue(Utils.timeOrDefault(_filtration.latestFilteredMarket, _timeProvider)));
    _fvPublisher.registerSnapshot(() => (this.latestFairValue === null ? [] : [ this.latestFairValue ]));
  }
  get latestFairValue() { return this._latest; }
  set latestFairValue(val) {
    if (this._latest != null
            && val != null
            && Math.abs(this._latest.price - val.price) < this._details.minTickIncrement) { return; }
    this._latest = val;
    this.FairValueChanged.trigger();
    this._fvPublisher.publish(this._latest);
    if (this._latest !== null) { this._fvPersister.persist(this._latest); }
  }
  static ComputeFVUnrounded(ask, bid, model) {
    switch (model) {
      case Models.FairValueModel.BBO:
        return (ask.price + bid.price) / 2.0;
      case Models.FairValueModel.wBBO:
        return (ask.price * ask.size + bid.price * bid.size) / (ask.size + bid.size);
    }
  }
  ComputeFV(ask, bid, model) {
    const unrounded = FairValueEngine.ComputeFVUnrounded(ask, bid, model);
    return Utils.roundNearest(unrounded, this._details.minTickIncrement);
  }
}
exports.FairValueEngine = FairValueEngine;
// # sourceMappingURL=fair-value.js.map
