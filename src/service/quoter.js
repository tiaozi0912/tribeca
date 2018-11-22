'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const Models = require('../common/models');
class QuoteOrder {
  constructor(quote, orderId) {
    this.quote = quote;
    this.orderId = orderId;
  }
}
class Quoter {
  constructor(broker, exchBroker) {
    this.updateQuote = (q, side) => {
      switch (side) {
        case Models.Side.Ask:
          return this._askQuoter.updateQuote(q);
        case Models.Side.Bid:
          return this._bidQuoter.updateQuote(q);
      }
    };
    this.cancelQuote = s => {
      switch (s.data) {
        case Models.Side.Ask:
          return this._askQuoter.cancelQuote(s.time);
        case Models.Side.Bid:
          return this._bidQuoter.cancelQuote(s.time);
      }
    };
    this.quotesSent = s => {
      switch (s) {
        case Models.Side.Ask:
          return this._askQuoter.quotesSent;
        case Models.Side.Bid:
          return this._bidQuoter.quotesSent;
      }
    };
    this._bidQuoter = new ExchangeQuoter(broker, exchBroker, Models.Side.Bid);
    this._askQuoter = new ExchangeQuoter(broker, exchBroker, Models.Side.Ask);
  }
}
exports.Quoter = Quoter;
class ExchangeQuoter {
  constructor(_broker, _exchBroker, _side) {
    this._broker = _broker;
    this._exchBroker = _exchBroker;
    this._side = _side;
    this._activeQuote = null;
    this.quotesSent = [];
    this.handleOrderUpdate = o => {
      switch (o.orderStatus) {
        case Models.OrderStatus.Cancelled:
        case Models.OrderStatus.Complete:
        case Models.OrderStatus.Rejected:
          const bySide = this._activeQuote;
          if (bySide !== null && bySide.orderId === o.orderId) {
            this._activeQuote = null;
          }
          this.quotesSent = this.quotesSent.filter(q => q.orderId !== o.orderId);
      }
    };
    this.updateQuote = q => {
      if (this._exchBroker.connectStatus !== Models.ConnectivityStatus.Connected) { return Models.QuoteSent.UnableToSend; }
      if (this._activeQuote !== null) {
        return this.modify(q);
      }
      return this.start(q);
    };
    this.cancelQuote = t => {
      if (this._exchBroker.connectStatus !== Models.ConnectivityStatus.Connected) { return Models.QuoteSent.UnableToSend; }
      return this.stop(t);
    };
    this.modify = q => {
      this.stop(q.time);
      this.start(q);
      return Models.QuoteSent.Modify;
    };
    this.start = q => {
      const existing = this._activeQuote;
      const newOrder = new Models.SubmitNewOrder(this._side, q.data.size, Models.OrderType.Limit, q.data.price, Models.TimeInForce.GTC, this._exchange, q.time, true, Models.OrderSource.Quote);
      const sent = this._broker.sendOrder(newOrder);
      const quoteOrder = new QuoteOrder(q.data, sent.sentOrderClientId);
      this.quotesSent.push(quoteOrder);
      this._activeQuote = quoteOrder;
      return Models.QuoteSent.First;
    };
    this.stop = t => {
      if (this._activeQuote === null) {
        return Models.QuoteSent.UnsentDelete;
      }
      const cxl = new Models.OrderCancel(this._activeQuote.orderId, this._exchange, t);
      this._broker.cancelOrder(cxl);
      this._activeQuote = null;
      return Models.QuoteSent.Delete;
    };
    this._exchange = _exchBroker.exchange();
    this._broker.OrderUpdate.on(this.handleOrderUpdate);
  }
}
exports.ExchangeQuoter = ExchangeQuoter;
// # sourceMappingURL=quoter.js.map
