'use strict';
const __awaiter = (this && this.__awaiter) || function(thisArg, _arguments, P, generator) {
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
    function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
    function step(result) { result.done ? resolve(result.value) : new P(function(resolve) { resolve(result.value); }).then(fulfilled, rejected); }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
Object.defineProperty(exports, '__esModule', { value: true });
const Models = require('../common/models');
const Utils = require('./utils');
const _ = require('lodash');
const Q = require('q');
const moment = require('moment');
const logging_1 = require('./logging');

class MarketDataBroker {
  constructor(time, _mdGateway, rawMarketPublisher, persister, _messages) {
    this._mdGateway = _mdGateway;
    this._messages = _messages;
    this.MarketData = new Utils.Evt();
    this._currentBook = null;
    this.handleMarketData = book => {
      this._currentBook = book;
      this.MarketData.trigger(this.currentBook);
    };
    time.setInterval(() => {
      if (!this.currentBook) { return; }
      rawMarketPublisher.publish(this._currentBook);
      persister.persist(new Models.Market(_.take(this.currentBook.bids, 3), _.take(this.currentBook.asks, 3), new Date()));
    }, moment.duration(1, 'second'));
    rawMarketPublisher.registerSnapshot(() => (this.currentBook === null ? [] : [ this.currentBook ]));
    this._mdGateway.MarketData.on(this.handleMarketData);
    this._mdGateway.ConnectChanged.on(s => {
      if (s == Models.ConnectivityStatus.Disconnected) { this._currentBook = null; }
      _messages.publish('MD gw ' + Models.ConnectivityStatus[s]);
    });
  }
  get currentBook() { return this._currentBook; }
}
exports.MarketDataBroker = MarketDataBroker;

class OrderStateCache {
  constructor() {
    this.allOrders = new Map();
    this.exchIdsToClientIds = new Map();
  }
}
exports.OrderStateCache = OrderStateCache;

class OrderBroker {
  constructor(_timeProvider, _baseBroker, _oeGateway, _orderPersister, _tradePersister, _orderStatusPublisher, _tradePublisher, _submittedOrderReciever, _cancelOrderReciever, _cancelAllOrdersReciever, _messages, _orderCache, initOrders, initTrades, _publishAllOrders) {
    this._timeProvider = _timeProvider;
    this._baseBroker = _baseBroker;
    this._oeGateway = _oeGateway;
    this._orderPersister = _orderPersister;
    this._tradePersister = _tradePersister;
    this._orderStatusPublisher = _orderStatusPublisher;
    this._tradePublisher = _tradePublisher;
    this._submittedOrderReciever = _submittedOrderReciever;
    this._cancelOrderReciever = _cancelOrderReciever;
    this._cancelAllOrdersReciever = _cancelAllOrdersReciever;
    this._messages = _messages;
    this._orderCache = _orderCache;
    this._publishAllOrders = _publishAllOrders;
    this._log = logging_1.default('oe:broker');
    this.OrderUpdate = new Utils.Evt();
    this._cancelsWaitingForExchangeOrderId = {};
    this.Trade = new Utils.Evt();
    this._trades = [];
    this.roundPrice = (price, side) => {
      return Utils.roundSide(price, this._baseBroker.minTickIncrement, side);
    };
    this.sendOrder = order => {
      const orderId = this._oeGateway.generateClientOrderId();
      const rpt = {
        pair: this._baseBroker.pair,
        orderId,
        side: order.side,
        quantity: order.quantity,
        type: order.type,
        price: this.roundPrice(order.price, order.side),
        timeInForce: order.timeInForce,
        orderStatus: Models.OrderStatus.New,
        preferPostOnly: order.preferPostOnly,
        exchange: this._baseBroker.exchange(),
        rejectMessage: order.msg,
        source: order.source,
      };
      this._oeGateway.sendOrder(this.updateOrderState(rpt));
      return new Models.SentOrder(rpt.orderId);
    };
    this.replaceOrder = replace => {
      const rpt = this._orderCache.allOrders.get(replace.origOrderId);
      if (!rpt) {
        throw new Error('Unknown order, cannot replace ' + replace.origOrderId);
      }
      const report = {
        orderId: replace.origOrderId,
        orderStatus: Models.OrderStatus.Working,
        pendingReplace: true,
        price: this.roundPrice(replace.price, rpt.side),
        quantity: replace.quantity,
      };
      this._oeGateway.replaceOrder(this.updateOrderState(rpt));
      return new Models.SentOrder(report.orderId);
    };
    this.cancelOrder = cancel => {
      const rpt = this._orderCache.allOrders.get(cancel.origOrderId);
      if (!this._oeGateway.cancelsByClientOrderId) {
        if (typeof rpt.exchangeId === 'undefined') {
          this._cancelsWaitingForExchangeOrderId[rpt.orderId] = cancel;
          this._log.info('Registered %s for late deletion', rpt.orderId);
          return;
        }
      }
      if (!rpt) {
        throw new Error('Unknown order, cannot cancel ' + cancel.origOrderId);
      }
      const report = {
        orderId: cancel.origOrderId,
        orderStatus: Models.OrderStatus.Working,
        pendingCancel: true,
      };
      this._oeGateway.cancelOrder(this.updateOrderState(report));
    };
    this.updateOrderState = osr => {
      let orig;
      if (osr.orderStatus === Models.OrderStatus.New) {
        orig = osr;
      } else {
        orig = this._orderCache.allOrders.get(osr.orderId);
        if (typeof orig === 'undefined') {
          const secondChance = this._orderCache.exchIdsToClientIds.get(osr.exchangeId);
          if (typeof secondChance !== 'undefined') {
            osr.orderId = secondChance;
            orig = this._orderCache.allOrders.get(secondChance);
          }
        }
        if (typeof orig === 'undefined') {
          this._log.error({
            update: osr,
            existingExchangeIdsToClientIds: this._orderCache.exchIdsToClientIds,
            existingIds: Array.from(this._orderCache.allOrders.keys()),
          }, 'no existing order for non-New update!');
          return;
        }
      }
      const getOrFallback = (n, o) => (typeof n !== 'undefined' ? n : o);
      const quantity = getOrFallback(osr.quantity, orig.quantity);
      const leavesQuantity = getOrFallback(osr.leavesQuantity, orig.leavesQuantity);
      let cumQuantity;
      if (typeof osr.cumQuantity !== 'undefined') {
        cumQuantity = getOrFallback(osr.cumQuantity, orig.cumQuantity);
      } else {
        cumQuantity = getOrFallback(orig.cumQuantity, 0) + getOrFallback(osr.lastQuantity, 0);
      }
      const partiallyFilled = cumQuantity > 0 && cumQuantity !== quantity;
      const o = {
        pair: getOrFallback(osr.pair, orig.pair),
        side: getOrFallback(osr.side, orig.side),
        quantity,
        type: getOrFallback(osr.type, orig.type),
        price: getOrFallback(osr.price, orig.price),
        timeInForce: getOrFallback(osr.timeInForce, orig.timeInForce),
        orderId: getOrFallback(osr.orderId, orig.orderId),
        exchangeId: getOrFallback(osr.exchangeId, orig.exchangeId),
        orderStatus: getOrFallback(osr.orderStatus, orig.orderStatus),
        rejectMessage: osr.rejectMessage,
        time: getOrFallback(osr.time, this._timeProvider.utcNow()),
        lastQuantity: osr.lastQuantity,
        lastPrice: osr.lastPrice,
        leavesQuantity,
        cumQuantity,
        averagePrice: cumQuantity > 0 ? osr.averagePrice || orig.averagePrice : undefined,
        liquidity: getOrFallback(osr.liquidity, orig.liquidity),
        exchange: getOrFallback(osr.exchange, orig.exchange),
        computationalLatency: getOrFallback(osr.computationalLatency, 0) + getOrFallback(orig.computationalLatency, 0),
        version: (typeof orig.version === 'undefined') ? 0 : orig.version + 1,
        partiallyFilled,
        pendingCancel: osr.pendingCancel,
        pendingReplace: osr.pendingReplace,
        cancelRejected: osr.cancelRejected,
        preferPostOnly: getOrFallback(osr.preferPostOnly, orig.preferPostOnly),
        source: getOrFallback(osr.source, orig.source),
      };
      const added = this.updateOrderStatusInMemory(o);
      if (this._log.debug()) { this._log.debug(o, (added ? 'added' : 'removed') + ' order status'); }
      if (!this._oeGateway.cancelsByClientOrderId
                && typeof o.exchangeId !== 'undefined'
                && o.orderId in this._cancelsWaitingForExchangeOrderId) {
        // this._log.info('Deleting %s late, oid: %s', o.exchangeId, o.orderId);
        const cancel = this._cancelsWaitingForExchangeOrderId[o.orderId];
        delete this._cancelsWaitingForExchangeOrderId[o.orderId];
        this.cancelOrder(cancel);
      }
      this.OrderUpdate.trigger(o);
      this._orderPersister.persist(o);
      if (this.shouldPublish(o)) { this._orderStatusPublisher.publish(o); }
      if (osr.lastQuantity > 0) {
        let value = Math.abs(o.lastPrice * o.lastQuantity);
        const liq = o.liquidity;
        let feeCharged = null;
        if (typeof liq !== 'undefined') {
          feeCharged = (liq === Models.Liquidity.Make ? this._baseBroker.makeFee() : this._baseBroker.takeFee());
          const sign = (o.side === Models.Side.Bid ? 1 : -1);
          value = value * (1 + sign * feeCharged);
        }
        const trade = new Models.Trade(o.orderId + '.' + o.version, o.time, o.exchange, o.pair, o.lastPrice, o.lastQuantity, o.side, value, o.liquidity, feeCharged);
        this.Trade.trigger(trade);
        this._tradePublisher.publish(trade);
        this._tradePersister.persist(trade);
        this._trades.push(trade);
      }
      return o;
    };
    this._pendingRemovals = new Array();
    this.updateOrderStatusInMemory = osr => {
      if (this.shouldPublish(osr) || !Models.orderIsDone(osr.orderStatus)) {
        this.addOrderStatusInMemory(osr);
        return true;
      }
      this._pendingRemovals.push(osr);
      return false;

    };
    this.addOrderStatusInMemory = osr => {
      this._orderCache.exchIdsToClientIds.set(osr.exchangeId, osr.orderId);
      this._orderCache.allOrders.set(osr.orderId, osr);
    };
    this.clearPendingRemovals = () => {
      const now = new Date().getTime();
      const kept = new Array();
      for (const osr of this._pendingRemovals) {
        if (now - osr.time.getTime() > 5000) {
          this._orderCache.exchIdsToClientIds.delete(osr.exchangeId);
          this._orderCache.allOrders.delete(osr.orderId);
        } else {
          kept.push(osr);
        }
      }
      this._pendingRemovals = kept;
    };
    this.shouldPublish = o => {
      if (o.source === null) { throw Error(JSON.stringify(o)); }
      if (this._publishAllOrders) { return true; }
      switch (o.source) {
        case Models.OrderSource.Quote:
        case Models.OrderSource.Unknown:
          return false;
        default:
          return true;
      }
    };
    this.orderStatusSnapshot = () => {
      return Array.from(this._orderCache.allOrders.values()).filter(this.shouldPublish);
    };
    _.each(initOrders, this.addOrderStatusInMemory);
    _.each(initTrades, t => this._trades.push(t));
    _orderStatusPublisher.registerSnapshot(() => this.orderStatusSnapshot());
    _tradePublisher.registerSnapshot(() => _.takeRight(this._trades, 100));
    _submittedOrderReciever.registerReceiver(o => {
      this._log.info('got new order req', o);
      try {
        const order = new Models.SubmitNewOrder(Models.Side[o.side], o.quantity, Models.OrderType[o.orderType], o.price, Models.TimeInForce[o.timeInForce], this._baseBroker.exchange(), _timeProvider.utcNow(), false, Models.OrderSource.OrderTicket);
        this.sendOrder(order);
      } catch (e) {
        this._log.error(e, 'unhandled exception while submitting order', o);
      }
    });
    _cancelOrderReciever.registerReceiver(o => {
      this._log.info('got new cancel req', o);
      try {
        this.cancelOrder(new Models.OrderCancel(o.orderId, o.exchange, _timeProvider.utcNow()));
      } catch (e) {
        this._log.error(e, 'unhandled exception while submitting order', o);
      }
    });
    _cancelAllOrdersReciever.registerReceiver(o => {
      this._log.info('handling cancel all orders request');
      this.cancelOpenOrders()
        .then(x => this._log.info('cancelled all ', x, ' open orders'), e => this._log.error(e, 'error when cancelling all orders!'));
    });
    this._oeGateway.OrderUpdate.on(this.updateOrderState);
    this._oeGateway.ConnectChanged.on(s => {
      _messages.publish('OE gw ' + Models.ConnectivityStatus[s]);
    });
    this._timeProvider.setInterval(this.clearPendingRemovals, moment.duration(5, 'seconds'));
  }
  cancelOpenOrders() {
    return __awaiter(this, void 0, void 0, function* () {
      if (this._oeGateway.supportsCancelAllOpenOrders()) {
        return this._oeGateway.cancelAllOpenOrders();
      }
      const promiseMap = new Map();
      const orderUpdate = o => {
        const p = promiseMap.get(o.orderId);
        if (p && Models.orderIsDone(o.orderStatus)) { p.resolve(null); }
      };
      this.OrderUpdate.on(orderUpdate);
      for (const e of this._orderCache.allOrders.values()) {
        if (e.pendingCancel || Models.orderIsDone(e.orderStatus)) { continue; }
        this.cancelOrder(new Models.OrderCancel(e.orderId, e.exchange, this._timeProvider.utcNow()));
        promiseMap.set(e.orderId, Q.defer());
      }
      const promises = Array.from(promiseMap.values());
      yield Q.all(promises);
      this.OrderUpdate.off(orderUpdate);
      return promises.length;
    });
  }
}
exports.OrderBroker = OrderBroker;
class PositionBroker {
  constructor(_timeProvider, _base, _posGateway, _positionPublisher, _positionPersister, _mdBroker) {
    this._timeProvider = _timeProvider;
    this._base = _base;
    this._posGateway = _posGateway;
    this._positionPublisher = _positionPublisher;
    this._positionPersister = _positionPersister;
    this._mdBroker = _mdBroker;
    this._log = logging_1.default('pos:broker');
    this.NewReport = new Utils.Evt();
    this._report = null;
    this._currencies = {};
    this.onPositionUpdate = rpt => {
      this._currencies[rpt.currency] = rpt;
      const basePosition = this.getPosition(this._base.pair.base);
      const quotePosition = this.getPosition(this._base.pair.quote);
      if (typeof basePosition === 'undefined'
                || typeof quotePosition === 'undefined'
                || this._mdBroker.currentBook === null
                || this._mdBroker.currentBook.bids.length === 0
                || this._mdBroker.currentBook.asks.length === 0) { return; }
      const baseAmount = basePosition.amount;
      const quoteAmount = quotePosition.amount;
      const mid = (this._mdBroker.currentBook.bids[0].price + this._mdBroker.currentBook.asks[0].price) / 2.0;
      const baseValue = baseAmount + quoteAmount / mid + basePosition.heldAmount + quotePosition.heldAmount / mid;
      const quoteValue = baseAmount * mid + quoteAmount + basePosition.heldAmount * mid + quotePosition.heldAmount;
      const positionReport = new Models.PositionReport(baseAmount, quoteAmount, basePosition.heldAmount, quotePosition.heldAmount, baseValue, quoteValue, this._base.pair, this._base.exchange(), this._timeProvider.utcNow());
      if (this._report !== null &&
                Math.abs(positionReport.value - this._report.value) < 2e-2 &&
                Math.abs(baseAmount - this._report.baseAmount) < 2e-2 &&
                Math.abs(positionReport.baseHeldAmount - this._report.baseHeldAmount) < 2e-2 &&
                Math.abs(positionReport.quoteHeldAmount - this._report.quoteHeldAmount) < 2e-2) { return; }
      this._report = positionReport;
      this.NewReport.trigger(positionReport);
      this._positionPublisher.publish(positionReport);
      this._positionPersister.persist(positionReport);
    };
    this._posGateway.PositionUpdate.on(this.onPositionUpdate);
    this._positionPublisher.registerSnapshot(() => (this._report === null ? [] : [ this._report ]));
  }
  get latestReport() {
    return this._report;
  }
  getPosition(currency) {
    return this._currencies[currency];
  }
}
exports.PositionBroker = PositionBroker;

class ExchangeBroker {
  constructor(_pair, _mdGateway, _baseGateway, _oeGateway, _connectivityPublisher) {
    this._pair = _pair;
    this._mdGateway = _mdGateway;
    this._baseGateway = _baseGateway;
    this._oeGateway = _oeGateway;
    this._connectivityPublisher = _connectivityPublisher;
    this._log = logging_1.default('ex:broker');
    this.ConnectChanged = new Utils.Evt();
    this.mdConnected = Models.ConnectivityStatus.Disconnected;
    this.oeConnected = Models.ConnectivityStatus.Disconnected;
    this._connectStatus = Models.ConnectivityStatus.Disconnected;
    this.onConnect = (gwType, cs) => {
      if (gwType === Models.GatewayType.MarketData) {
        if (this.mdConnected === cs) { return; }
        this.mdConnected = cs;
      }
      if (gwType === Models.GatewayType.OrderEntry) {
        if (this.oeConnected === cs) { return; }
        this.oeConnected = cs;
      }
      const newStatus = this.mdConnected === Models.ConnectivityStatus.Connected && this.oeConnected === Models.ConnectivityStatus.Connected
        ? Models.ConnectivityStatus.Connected
        : Models.ConnectivityStatus.Disconnected;
      this._connectStatus = newStatus;
      this.ConnectChanged.trigger(newStatus);
      this._log.info('Connection status changed :: %s :: (md: %s) (oe: %s)', Models.ConnectivityStatus[this._connectStatus], Models.ConnectivityStatus[this.mdConnected], Models.ConnectivityStatus[this.oeConnected]);
      this._connectivityPublisher.publish(this.connectStatus);
    };
    this._mdGateway.ConnectChanged.on(s => {
      this.onConnect(Models.GatewayType.MarketData, s);
    });
    this._oeGateway.ConnectChanged.on(s => {
      this.onConnect(Models.GatewayType.OrderEntry, s);
    });
    this._connectivityPublisher.registerSnapshot(() => [ this.connectStatus ]);
  }
  get hasSelfTradePrevention() {
    return this._baseGateway.hasSelfTradePrevention;
  }
  makeFee() {
    return this._baseGateway.makeFee();
  }
  takeFee() {
    return this._baseGateway.takeFee();
  }
  exchange() {
    return this._baseGateway.exchange();
  }
  get pair() {
    return this._pair;
  }
  get minTickIncrement() {
    return this._baseGateway.minTickIncrement;
  }
  get connectStatus() {
    return this._connectStatus;
  }
}
exports.ExchangeBroker = ExchangeBroker;
// # sourceMappingURL=broker.js.map
