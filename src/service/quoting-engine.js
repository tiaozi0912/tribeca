'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const Models = require('../common/models');
const Utils = require('./utils');
const moment = require('moment');
const helpers_1 = require('./quoting-styles/helpers');
const logging_1 = require('./logging');
const debug = require('debug')('tribeca:quotingEngine');

const quoteChanged = (o, n, tick) => {
  if ((!o && n) || (o && !n)) { return true; }
  if (!o && !n) { return false; }
  const oPx = (o && o.price) || 0;
  const nPx = (n && n.price) || 0;
  if (Math.abs(oPx - nPx) > tick) { return true; }
  const oSz = (o && o.size) || 0;
  const nSz = (n && n.size) || 0;
  return Math.abs(oSz - nSz) > 0.001;
};
const quotesChanged = (o, n, tick) => {
  if ((!o && n) || (o && !n)) { return true; }
  if (!o && !n) { return false; }
  if (quoteChanged(o.bid, n.bid, tick)) { return true; }
  if (quoteChanged(o.ask, n.ask, tick)) { return true; }
  return false;
};

class QuotingEngine {
  constructor(_registry, _timeProvider, _filteredMarkets, _fvEngine, _qlParamRepo, _quotePublisher, _orderBroker, _positionBroker, _details, _ewma, _targetPosition, _safeties) {
    this._registry = _registry;
    this._timeProvider = _timeProvider;
    this._filteredMarkets = _filteredMarkets;
    this._fvEngine = _fvEngine;
    this._qlParamRepo = _qlParamRepo;
    this._quotePublisher = _quotePublisher;
    this._orderBroker = _orderBroker;
    this._positionBroker = _positionBroker;
    this._details = _details;
    this._ewma = _ewma;
    this._targetPosition = _targetPosition;
    this._safeties = _safeties;
    this._log = logging_1.default('quotingengine');
    this.QuoteChanged = new Utils.Evt();
    this._latest = null;

    this.recalcQuote = t => {
      const fv = this._fvEngine.latestFairValue;
      if (fv === null) {
        this.latestQuote = null;
        return;
      }
      const filteredMkt = this._filteredMarkets.latestFilteredMarket;
      if (filteredMkt === null) {
        this.latestQuote = null;
        return;
      }

      // Calculate genQt based on filteredMkt and fair value
      const genQt = this.computeQuote(filteredMkt, fv);
      if (genQt === null) {
        this.latestQuote = null;
        return;
      }
      const bidQuote = this.quotesAreSame(
        new Models.Quote(genQt.bidPx, genQt.bidSz), this.latestQuote, Models.Side.Bid
      );
      const askQuote = this.quotesAreSame(
        new Models.Quote(genQt.askPx, genQt.askSz),
        this.latestQuote, Models.Side.Ask
      );

      // Update the latestQuote
      this.latestQuote = new Models.TwoSidedQuote(bidQuote, askQuote, t);
    };

    const recalcWithoutInputTime = () => this.recalcQuote(_timeProvider.utcNow());

    _filteredMarkets.FilteredMarketChanged.on(m => this.recalcQuote(Utils.timeOrDefault(m, _timeProvider)));
    _qlParamRepo.NewParameters.on(recalcWithoutInputTime);
    _orderBroker.Trade.on(recalcWithoutInputTime);
    _ewma.Updated.on(recalcWithoutInputTime);
    _quotePublisher.registerSnapshot(() => (this.latestQuote === null ? [] : [ this.latestQuote ]));
    _targetPosition.NewTargetPosition.on(recalcWithoutInputTime);
    _safeties.NewValue.on(recalcWithoutInputTime);

    // Calculate the quote every 1 sec
    _timeProvider.setInterval(recalcWithoutInputTime, moment.duration(1, 'seconds'));
  }

  get latestQuote() { return this._latest; }

  set latestQuote(val) {
    if (!quotesChanged(this._latest, val, this._details.minTickIncrement)) { return; }
    this._latest = val;
    this.QuoteChanged.trigger();
    this._quotePublisher.publish(this._latest);
  }

  // Core logic to compute order quote
  computeQuote(filteredMkt, fv) {
    const params = this._qlParamRepo.latest;
    const minTick = this._details.minTickIncrement;
    const input = new helpers_1.QuoteInput(filteredMkt, fv, params, minTick);

    /* ------------------ */
    // unrounded will be retruend as the computed quote
    // this._registry is the QuotingStyleRegistry instance
    const quoteStyle = this._registry.Get(params.mode);
    const unrounded = quoteStyle.GenerateQuote(input);
    /* ------------------ */

    if (unrounded === null) { return null; }
    if (params.ewmaProtection && this._ewma.latest !== null) {
      if (this._ewma.latest > unrounded.askPx) {
        unrounded.askPx = Math.max(this._ewma.latest, unrounded.askPx);
      }
      if (this._ewma.latest < unrounded.bidPx) {
        unrounded.bidPx = Math.min(this._ewma.latest, unrounded.bidPx);
      }
    }
    const tbp = this._targetPosition.latestTargetPosition;
    if (tbp === null) {
      this._log.warn('cannot compute a quote since no position report exists!');
      return null;
    }
    const targetBasePosition = tbp.data;
    const latestPosition = this._positionBroker.latestReport;
    const totalBasePosition = latestPosition.baseAmount + latestPosition.baseHeldAmount;

    // If totalBasePosition is too small
    // Stop selling it by setting askPx & askSz null
    // Trigger balance if aggressivePositionRebalancing is true
    if (totalBasePosition < targetBasePosition - params.positionDivergence) {
      // this._log.warn(`totalBasePosition is too small: ${totalBasePosition}. targetBasePosition: ${targetBasePosition}. params.positionDivergence: ${params.positionDivergence}`);
      unrounded.askPx = null;
      unrounded.askSz = null;
      if (params.aggressivePositionRebalancing) {
        // this._log.info('aggressive position rebalancing triggered');
        unrounded.bidSz = Math.min(params.aprMultiplier * params.size, targetBasePosition - totalBasePosition);
      }
    }

    // If totalBasePosition is too big
    // Stop buying it by setting bidPx & bidSz null
    // Trigger balance if aggressivePositionRebalancing is true
    if (totalBasePosition > targetBasePosition + params.positionDivergence) {
      // this._log.warn(`totalBasePosition is too big: ${totalBasePosition}. targetBasePosition: ${targetBasePosition}. params.positionDivergence: ${params.positionDivergence}`);
      unrounded.bidPx = null;
      unrounded.bidSz = null;
      if (params.aggressivePositionRebalancing) {
        // this._log.info('aggressive position rebalancing triggered');
        unrounded.askSz = Math.min(params.aprMultiplier * params.size, totalBasePosition - targetBasePosition);
      }
    }
    const safety = this._safeties.latest;

    // debug('safety:', safety);

    if (safety === null) {
      return null;
    }
    if (params.mode === Models.QuotingMode.PingPong) {
      if (unrounded.askSz && safety.buyPing && unrounded.askPx < safety.buyPing + params.width) {
        unrounded.askPx = safety.buyPing + params.width;
      }
      if (unrounded.bidSz && safety.sellPong && unrounded.bidPx > safety.sellPong - params.width) {
        unrounded.bidPx = safety.sellPong - params.width;
      }
    }
    if (safety.sell > params.tradesPerMinute) {
      unrounded.askPx = null;
      unrounded.askSz = null;
    }
    if (safety.buy > params.tradesPerMinute) {
      unrounded.bidPx = null;
      unrounded.bidSz = null;
    }

    if (unrounded.bidPx !== null) {
      unrounded.bidPx = Utils.roundSide(unrounded.bidPx, minTick, Models.Side.Bid);
      unrounded.bidPx = Math.max(0, unrounded.bidPx);
    }
    if (unrounded.askPx !== null) {
      unrounded.askPx = Utils.roundSide(unrounded.askPx, minTick, Models.Side.Ask);
      unrounded.askPx = Math.max(unrounded.bidPx + minTick, unrounded.askPx);
    }

    // @Todo:
    // minTick应该是价格的precision， 而不是order size的precision
    // debug('askSz before rounded:', unrounded.askSz);
    if (unrounded.askSz !== null) {
      unrounded.askSz = Utils.roundDown(unrounded.askSz, minTick);
      unrounded.askSz = Math.max(minTick, unrounded.askSz);
      // debug('askSz after rounded:', unrounded.askSz);
    }

    // debug('bidSz before rounded:', unrounded.bidSz);
    if (unrounded.bidSz !== null) {
      unrounded.bidSz = Utils.roundDown(unrounded.bidSz, minTick);
      unrounded.bidSz = Math.max(minTick, unrounded.bidSz);
      // debug('bidSz after rounded:', unrounded.bidSz);
    }
    return unrounded;
  }

  /**
   * @description Based on the previous quote of the same side, determine if the quote is updated
   * If the diff of the quote prices are too small, use the previous quote
   * If the quote is not widen and the time diff betweeen the new quote and previous one is too small, use the previous quote
   * Otherwise, return the new one
   *
   * @param {Quote} newQ new quote
   * @param {Object} prevTwoSided {bid: <Quote>, ask: <Quote>}
   * @param {String} side bid or ask side
   * @return {Quote} quote
   */
  quotesAreSame(newQ, prevTwoSided, side) {
    if (newQ.price === null && newQ.size === null) { return null; }

    if (prevTwoSided === null) { return newQ; }

    const previousQ = Models.Side.Bid === side ? prevTwoSided.bid : prevTwoSided.ask;

    if (previousQ === null && newQ !== null) { return newQ; }

    if (Math.abs(newQ.size - previousQ.size) > 5e-3) { return newQ; }

    if (Math.abs(newQ.price - previousQ.price) < this._details.minTickIncrement) {
      return previousQ;
    }

    let quoteWasWidened = true;

    // If it is bid side, quote is widen if new price < previous price
    if (Models.Side.Bid === side && previousQ.price < newQ.price) { quoteWasWidened = false; }

    // If it is ask side, quote is widen if new price > previous price
    if (Models.Side.Ask === side && previousQ.price > newQ.price) { quoteWasWidened = false; }

    if (!quoteWasWidened && Math.abs(Utils.fastDiff(new Date(), prevTwoSided.time)) < 300) {
      return previousQ;
    }
    return newQ;
  }
}

exports.QuotingEngine = QuotingEngine;
// # sourceMappingURL=quoting-engine.js.map
