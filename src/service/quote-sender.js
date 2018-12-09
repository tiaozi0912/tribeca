'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const Models = require('../common/models');
const Utils = require('./utils');
const _ = require('lodash');
const logging_1 = require('./logging');
const debug = require('debug')('tribeca:quoteSender');

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
      // debug('quote:', quote);
      // debug('activeRepo.latest:', this._activeRepo.latest);

      if (quote !== null && this._activeRepo.latest) {
        if (quote.ask !== null) {
          const hasEnoughPositionForAsk = this.hasEnoughPosition(this._details.pair.base, quote.ask.size);
          const checkCrossedAskQuotes = this.checkCrossedQuotes(Models.Side.Ask, quote.ask.price);
          // debug('Enough position for ask:', hasEnoughPositionForAsk);
          // debug('checkCrossedAskQuotes:', checkCrossedAskQuotes);

          if (
            hasEnoughPositionForAsk
             &&
            (
              this._details.hasSelfTradePrevention ||
              !checkCrossedAskQuotes
            )
          ) {
            askStatus = Models.QuoteStatus.Live;
          }
        }
        if (quote.bid !== null) {
          const hasEnoughPositionForBid = this.hasEnoughPosition(this._details.pair.quote, quote.bid.size * quote.bid.price);
          const checkCrossedBidQuotes = this.checkCrossedQuotes(Models.Side.Bid, quote.bid.price);
          // debug('Enough position for bid:', hasEnoughPositionForBid);
          // debug('checkCrossedBidQuotes:', checkCrossedBidQuotes);

          if (
            hasEnoughPositionForBid &&
            (
              this._details.hasSelfTradePrevention ||
              !checkCrossedBidQuotes
            )
          ) {
            bidStatus = Models.QuoteStatus.Live;
          }
        }
      }
      let askAction;
      if (askStatus === Models.QuoteStatus.Live) {
        debug('Update ask quote');
        // quoter.updateQuote -> exchangeQuoter.updateQuote
        // -> exchangeQuoter.modify(q) or start(q)
        // start:
        // - new SubmitNewOrder object and exchangeQuoter._broker<IOrderBroker>.sendOrder
        // - new QuoteOrder object and push in the exchangeQuoter.quotesSent queue
        // - set exchangeQuoter._activeQuote = quoteOrder
        // modify:
        // - exchangeQuoter._broker.cancelOrder
        // - exchangeQuoter._activeQuote = null
        // - call start
        askAction = this._quoter.updateQuote(new Models.Timestamped(quote.ask, t), Models.Side.Ask);
      } else {
        debug('Cancel ask quote');
        askAction = this._quoter.cancelQuote(new Models.Timestamped(Models.Side.Ask, t));
      }
      let bidAction;
      if (bidStatus === Models.QuoteStatus.Live) {
        debug('Update bid quote');
        bidAction = this._quoter.updateQuote(new Models.Timestamped(quote.bid, t), Models.Side.Bid);
      } else {
        debug('Cancel bid quote');
        bidAction = this._quoter.cancelQuote(new Models.Timestamped(Models.Side.Bid, t));
      }
      this.latestStatus = new Models.TwoSidedQuoteStatus(bidStatus, askStatus);
    };
    this.hasEnoughPosition = (cur, minAmt) => {
      const pos = this._positionBroker.getPosition(cur);
      return pos != null && pos.amount > minAmt;
    };
    _activeRepo.NewParameters.on(() => this.sendQuote(_timeProvider.utcNow()));

    // Send quote when quote changed
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
