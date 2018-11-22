'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const Models = require('../common/models');
const Utils = require('./utils');
const _ = require('lodash');
const logging_1 = require('./logging');
class QuoteSender {
  constructor(_timeProvider, _quotingEngine, _statusPublisher, _quoter, _activeRepo, _positionBroker, _fv, _broker, _details) {
    this._timeProvider = _timeProvider;
    this._quotingEngine = _quotingEngine;
    this._statusPublisher = _statusPublisher;
    this._quoter = _quoter;
    this._activeRepo = _activeRepo;
    this._positionBroker = _positionBroker;
    this._fv = _fv;
    this._broker = _broker;
    this._details = _details;
    this._log = logging_1.default('quotesender');
    this._latest = new Models.TwoSidedQuoteStatus(Models.QuoteStatus.Held, Models.QuoteStatus.Held);
    this.checkCrossedQuotes = (side, px) => {
      const oppSide = side === Models.Side.Bid ? Models.Side.Ask : Models.Side.Bid;
      const doesQuoteCross = oppSide === Models.Side.Bid
        ? (a, b) => a.price >= b
        : (a, b) => a.price <= b;
      const qs = this._quoter.quotesSent(oppSide);
      for (let qi = 0; qi < qs.length; qi++) {
        if (doesQuoteCross(qs[qi].quote, px)) {
          this._log.warn('crossing quote detected! gen quote at %d would crossed with %s quote at', px, Models.Side[oppSide], qs[qi]);
          return true;
        }
      }
      return false;
    };
    this.sendQuote = t => {
      const quote = this._quotingEngine.latestQuote;
      let askStatus = Models.QuoteStatus.Held;
      let bidStatus = Models.QuoteStatus.Held;
      if (quote !== null && this._activeRepo.latest) {
        if (quote.ask !== null && this.hasEnoughPosition(this._details.pair.base, quote.ask.size) &&
                    (this._details.hasSelfTradePrevention || !this.checkCrossedQuotes(Models.Side.Ask, quote.ask.price))) {
          askStatus = Models.QuoteStatus.Live;
        }
        if (quote.bid !== null && this.hasEnoughPosition(this._details.pair.quote, quote.bid.size * quote.bid.price) &&
                    (this._details.hasSelfTradePrevention || !this.checkCrossedQuotes(Models.Side.Bid, quote.bid.price))) {
          bidStatus = Models.QuoteStatus.Live;
        }
      }
      let askAction;
      if (askStatus === Models.QuoteStatus.Live) {
        askAction = this._quoter.updateQuote(new Models.Timestamped(quote.ask, t), Models.Side.Ask);
      } else {
        askAction = this._quoter.cancelQuote(new Models.Timestamped(Models.Side.Ask, t));
      }
      let bidAction;
      if (bidStatus === Models.QuoteStatus.Live) {
        bidAction = this._quoter.updateQuote(new Models.Timestamped(quote.bid, t), Models.Side.Bid);
      } else {
        bidAction = this._quoter.cancelQuote(new Models.Timestamped(Models.Side.Bid, t));
      }
      this.latestStatus = new Models.TwoSidedQuoteStatus(bidStatus, askStatus);
    };
    this.hasEnoughPosition = (cur, minAmt) => {
      const pos = this._positionBroker.getPosition(cur);
      return pos != null && pos.amount > minAmt;
    };
    _activeRepo.NewParameters.on(() => this.sendQuote(_timeProvider.utcNow()));
    _quotingEngine.QuoteChanged.on(() => this.sendQuote(Utils.timeOrDefault(_quotingEngine.latestQuote, _timeProvider)));
    _statusPublisher.registerSnapshot(() => (this.latestStatus === null ? [] : [ this.latestStatus ]));
  }
  get latestStatus() { return this._latest; }
  set latestStatus(val) {
    if (_.isEqual(val, this._latest)) { return; }
    this._latest = val;
    this._statusPublisher.publish(this._latest);
  }
}
exports.QuoteSender = QuoteSender;
// # sourceMappingURL=quote-sender.js.map
