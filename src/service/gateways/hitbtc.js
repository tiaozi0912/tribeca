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
const crypto = require('crypto');
const websocket_1 = require('../websocket');
const request = require('request');
const url = require('url');
const querystring = require('querystring');
const NullGateway = require('./nullgw');
const Models = require('../../common/models');
const Utils = require('../utils');
const Interfaces = require('../interfaces');
const io = require('socket.io-client');
const Q = require('q');
const logging_1 = require('../logging');
const shortId = require('shortid');
const SortedMap = require('collections/sorted-map');
const _lotMultiplier = 100.0;
class SideMarketData {
  constructor(side) {
    this._collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    this.update = (k, v) => {
      if (v.size === 0) {
        this._data.delete(k);
        return;
      }
      const existing = this._data.get(k);
      if (existing) {
        existing.size = v.size;
      } else {
        this._data.set(k, v);
      }
    };
    this.clear = () => this._data.clear();
    this.getBest = n => {
      const b = new Array();
      const it = (this._data).iterator();
      while (b.length < n) {
        const x = it.next();
        if (x.done) { return b; }
        b.push(x.value.value);
      }
      return b;
    };
    this.any = () => (this._data).any();
    this.min = () => (this._data).min();
    this.max = () => (this._data).max();
    const compare = side === Models.Side.Bid ?
      (a, b) => this._collator.compare(b, a) :
      (a, b) => this._collator.compare(a, b);
    this._data = new SortedMap([], null, compare);
  }
}
class HitBtcMarketDataGateway {
  constructor(config, _symbolProvider, _minTick) {
    this._symbolProvider = _symbolProvider;
    this._minTick = _minTick;
    this.MarketData = new Utils.Evt();
    this.MarketTrade = new Utils.Evt();
    this._hasProcessedSnapshot = false;
    this._lastBids = new SideMarketData(Models.Side.Bid);
    this._lastAsks = new SideMarketData(Models.Side.Ask);
    this.onMarketDataIncrementalRefresh = (msg, t) => {
      if (msg.symbol !== this._symbolProvider.symbol || !this._hasProcessedSnapshot) { return; }
      this.onMarketDataUpdate(msg.bid, msg.ask, t);
    };
    this.onMarketDataSnapshotFullRefresh = (msg, t) => {
      if (msg.symbol !== this._symbolProvider.symbol) { return; }
      this._lastAsks.clear();
      this._lastBids.clear();
      this.onMarketDataUpdate(msg.bid, msg.ask, t);
      this._hasProcessedSnapshot = true;
    };
    this.onMarketDataUpdate = (bids, asks, t) => {
      const ordBids = this.applyUpdates(bids, this._lastBids);
      const ordAsks = this.applyUpdates(asks, this._lastAsks);
      this.MarketData.trigger(new Models.Market(ordBids, ordAsks, t));
    };
    this.onMessage = raw => {
      let msg;
      try {
        msg = JSON.parse(raw.data);
      } catch (e) {
        this._log.error(e, 'Error parsing msg', raw);
        throw e;
      }
      if (this._log.debug()) { this._log.debug(msg, 'message'); }
      if (msg.hasOwnProperty('MarketDataIncrementalRefresh')) {
        this.onMarketDataIncrementalRefresh(msg.MarketDataIncrementalRefresh, raw.time);
      } else if (msg.hasOwnProperty('MarketDataSnapshotFullRefresh')) {
        this.onMarketDataSnapshotFullRefresh(msg.MarketDataSnapshotFullRefresh, raw.time);
      } else {
        this._log.info('unhandled message', msg);
      }
    };
    this.ConnectChanged = new Utils.Evt();
    this.onConnectionStatusChange = () => {
      if (this._marketDataWs.isConnected && this._tradesClient.connected) {
        this.ConnectChanged.trigger(Models.ConnectivityStatus.Connected);
      } else {
        this.ConnectChanged.trigger(Models.ConnectivityStatus.Disconnected);
      }
    };
    this.onTrade = t => {
      let side = Models.Side.Unknown;
      if (this._lastAsks.any() && this._lastBids.any()) {
        const distance_from_bid = Math.abs(this._lastBids.max().price - t.price);
        const distance_from_ask = Math.abs(this._lastAsks.min().price - t.price);
        if (distance_from_bid < distance_from_ask) { side = Models.Side.Bid; }
        if (distance_from_bid > distance_from_ask) { side = Models.Side.Ask; }
      }
      this.MarketTrade.trigger(new Models.GatewayMarketTrade(t.price, t.amount, new Date(), false, side));
    };
    this._log = logging_1.default('tribeca:gateway:HitBtcMD');
    this._marketDataWs = new websocket_1.default(config.GetString('HitBtcMarketDataUrl'), 5000, this.onMessage, this.onConnectionStatusChange, this.onConnectionStatusChange);
    this._marketDataWs.connect();
    this._tradesClient = io.connect(config.GetString('HitBtcSocketIoUrl') + '/trades/' + this._symbolProvider.symbol);
    this._tradesClient.on('connect', this.onConnectionStatusChange);
    this._tradesClient.on('trade', this.onTrade);
    this._tradesClient.on('disconnect', this.onConnectionStatusChange);
    request.get({ url: url.resolve(config.GetString('HitBtcPullUrl'), '/api/1/public/' + this._symbolProvider.symbol + '/orderbook') }, (err, body, resp) => {
      this.onMarketDataSnapshotFullRefresh(resp, Utils.date());
    });
    request.get({ url: url.resolve(config.GetString('HitBtcPullUrl'), '/api/1/public/' + this._symbolProvider.symbol + '/trades'),
      qs: { from: 0, by: 'trade_id', sort: 'desc', start_index: 0, max_results: 100 } }, (err, body, resp) => {
      JSON.parse(body.body).trades.forEach(t => {
        const price = parseFloat(t[1]);
        const size = parseFloat(t[2]);
        const time = new Date(t[3]);
        this.MarketTrade.trigger(new Models.GatewayMarketTrade(price, size, time, true, null));
      });
    });
  }
  applyUpdates(incomingUpdates, side) {
    for (const u of incomingUpdates) {
      const ms = new Models.MarketSide(parseFloat(u.price), u.size / _lotMultiplier);
      side.update(u.price, ms);
    }
    return side.getBest(25);
  }
}
class HitBtcOrderEntryGateway {
  constructor(config, _symbolProvider, _details) {
    this._symbolProvider = _symbolProvider;
    this._details = _details;
    this.OrderUpdate = new Utils.Evt();
    this.cancelsByClientOrderId = true;
    this.supportsCancelAllOpenOrders = () => { return false; };
    this.cancelAllOpenOrders = () => { return Q(0); };
    this._nonce = 1;
    this.cancelOrder = cancel => {
      this.sendAuth('OrderCancel', { clientOrderId: cancel.orderId,
        cancelRequestClientOrderId: cancel.orderId + 'C',
        symbol: this._symbolProvider.symbol,
        side: HitBtcOrderEntryGateway.getSide(cancel.side) }, () => {
        this.OrderUpdate.trigger({
          orderId: cancel.orderId,
          computationalLatency: Utils.fastDiff(Utils.date(), cancel.time),
        });
      });
    };
    this.replaceOrder = replace => {
      this.cancelOrder(replace);
      return this.sendOrder(replace);
    };
    this.sendOrder = order => {
      const hitBtcOrder = {
        clientOrderId: order.orderId,
        symbol: this._symbolProvider.symbol,
        side: HitBtcOrderEntryGateway.getSide(order.side),
        quantity: order.quantity * _lotMultiplier,
        type: HitBtcOrderEntryGateway.getType(order.type),
        price: order.price,
        timeInForce: HitBtcOrderEntryGateway.getTif(order.timeInForce),
      };
      this.sendAuth('NewOrder', hitBtcOrder, () => {
        this.OrderUpdate.trigger({
          orderId: order.orderId,
          computationalLatency: Utils.fastDiff(Utils.date(), order.time),
        });
      });
    };
    this.onExecutionReport = tsMsg => {
      const t = tsMsg.time;
      const msg = tsMsg.data;
      const ordStatus = HitBtcOrderEntryGateway.getStatus(msg);
      let lastQuantity;
      let lastPrice;
      const status = {
        exchangeId: msg.orderId,
        orderId: msg.clientOrderId,
        orderStatus: ordStatus,
        time: t,
      };
      if (msg.lastQuantity > 0 && msg.execReportType === 'trade') {
        status.lastQuantity = msg.lastQuantity / _lotMultiplier;
        status.lastPrice = msg.lastPrice;
      }
      if (msg.orderRejectReason) { status.rejectMessage = msg.orderRejectReason; }
      if (status.leavesQuantity) { status.leavesQuantity = msg.leavesQuantity / _lotMultiplier; }
      if (msg.cumQuantity) { status.cumQuantity = msg.cumQuantity / _lotMultiplier; }
      if (msg.averagePrice) { status.averagePrice = msg.averagePrice; }
      this.OrderUpdate.trigger(status);
    };
    this.onCancelReject = tsMsg => {
      const msg = tsMsg.data;
      const status = {
        orderId: msg.clientOrderId,
        rejectMessage: msg.rejectReasonText,
        orderStatus: Models.OrderStatus.Rejected,
        cancelRejected: true,
        time: tsMsg.time,
      };
      this.OrderUpdate.trigger(status);
    };
    this.authMsg = payload => {
      const msg = { nonce: this._nonce, payload };
      this._nonce += 1;
      const signMsg = m => {
        return crypto.createHmac('sha512', this._secret)
          .update(JSON.stringify(m))
          .digest('base64');
      };
      return { apikey: this._apiKey, signature: signMsg(msg), message: msg };
    };
    this.sendAuth = (msgType, msg, cb) => {
      const v = {};
      v[msgType] = msg;
      const readyMsg = this.authMsg(v);
      this._orderEntryWs.send(JSON.stringify(readyMsg), cb);
    };
    this.ConnectChanged = new Utils.Evt();
    this.onConnectionStatusChange = () => {
      if (this._orderEntryWs.isConnected) {
        this.ConnectChanged.trigger(Models.ConnectivityStatus.Connected);
      } else {
        this.ConnectChanged.trigger(Models.ConnectivityStatus.Disconnected);
      }
    };
    this.onOpen = () => {
      this.sendAuth('Login', {});
      this.onConnectionStatusChange();
    };
    this.onMessage = raw => {
      try {
        const msg = JSON.parse(raw.data);
        if (this._log.debug()) { this._log.debug(msg, 'message'); }
        if (msg.hasOwnProperty('ExecutionReport')) {
          this.onExecutionReport(new Models.Timestamped(msg.ExecutionReport, raw.time));
        } else if (msg.hasOwnProperty('CancelReject')) {
          this.onCancelReject(new Models.Timestamped(msg.CancelReject, raw.time));
        } else {
          this._log.info('unhandled message', msg);
        }
      } catch (e) {
        this._log.error(e, 'exception while processing message', raw);
        throw e;
      }
    };
    this.generateClientOrderId = () => {
      return shortId.generate();
    };
    this._log = logging_1.default('tribeca:gateway:HitBtcOE');
    this._apiKey = config.GetString('HitBtcApiKey');
    this._secret = config.GetString('HitBtcSecret');
    this._orderEntryWs = new websocket_1.default(config.GetString('HitBtcOrderEntryUrl'), 5000, this.onMessage, this.onOpen, this.onConnectionStatusChange);
    this._orderEntryWs.connect();
  }
  static getStatus(m) {
    switch (m.execReportType) {
      case 'new':
      case 'status':
        return Models.OrderStatus.Working;
      case 'canceled':
      case 'expired':
        return Models.OrderStatus.Cancelled;
      case 'rejected':
        return Models.OrderStatus.Rejected;
      case 'trade':
        if (m.orderStatus == 'filled') { return Models.OrderStatus.Complete; }
        return Models.OrderStatus.Working;
      default:
        return Models.OrderStatus.Other;
    }
  }
  static getTif(tif) {
    switch (tif) {
      case Models.TimeInForce.FOK:
        return 'FOK';
      case Models.TimeInForce.GTC:
        return 'GTC';
      case Models.TimeInForce.IOC:
        return 'IOC';
    }
  }
  static getSide(side) {
    switch (side) {
      case Models.Side.Bid:
        return 'buy';
      case Models.Side.Ask:
        return 'sell';
      default:
        throw new Error('Side ' + Models.Side[side] + ' not supported in HitBtc');
    }
  }
  static getType(t) {
    switch (t) {
      case Models.OrderType.Limit:
        return 'limit';
      case Models.OrderType.Market:
        return 'market';
    }
  }
}
class HitBtcPositionGateway {
  constructor(config) {
    this._log = logging_1.default('tribeca:gateway:HitBtcPG');
    this.PositionUpdate = new Utils.Evt();
    this.getAuth = uri => {
      const nonce = new Date().getTime() * 1000;
      const comb = uri + '?' + querystring.stringify({ nonce, apikey: this._apiKey });
      const signature = crypto.createHmac('sha512', this._secret)
        .update(comb)
        .digest('hex')
        .toString()
        .toLowerCase();
      return { url: url.resolve(this._pullUrl, uri),
        method: 'GET',
        headers: { 'X-Signature': signature },
        qs: { nonce: nonce.toString(), apikey: this._apiKey } };
    };
    this.onTick = () => {
      request.get(this.getAuth('/api/1/trading/balance'), (err, body, resp) => {
        try {
          const rpts = JSON.parse(resp).balance;
          if (typeof rpts === 'undefined' || err) {
            this._log.warn(err, 'Trouble getting positions', body.body);
            return;
          }
          rpts.forEach(r => {
            let currency;
            try {
              currency = Models.toCurrency(r.currency_code);
            } catch (e) {
              return;
            }
            if (currency == null) { return; }
            const position = new Models.CurrencyPosition(r.cash, r.reserved, currency);
            this.PositionUpdate.trigger(position);
          });
        } catch (e) {
          this._log.error(e, 'Error processing JSON response ', resp);
        }
      });
    };
    this._apiKey = config.GetString('HitBtcApiKey');
    this._secret = config.GetString('HitBtcSecret');
    this._pullUrl = config.GetString('HitBtcPullUrl');
    this.onTick();
    setInterval(this.onTick, 15000);
  }
}
class HitBtcBaseGateway {
  constructor(minTickIncrement) {
    this.minTickIncrement = minTickIncrement;
  }
  get hasSelfTradePrevention() {
    return false;
  }
  exchange() {
    return Models.Exchange.HitBtc;
  }
  makeFee() {
    return -0.0001;
  }
  takeFee() {
    return 0.001;
  }
  name() {
    return 'HitBtc';
  }
}
class HitBtcSymbolProvider {
  constructor(pair) {
    this.symbol = Models.fromCurrency(pair.base) + Models.fromCurrency(pair.quote);
  }
}
class HitBtc extends Interfaces.CombinedGateway {
  constructor(config, symbolProvider, step, pair) {
    const details = new HitBtcBaseGateway(step);
    const orderGateway = config.GetString('HitBtcOrderDestination') == 'HitBtc' ?
      new HitBtcOrderEntryGateway(config, symbolProvider, details)
      : new NullGateway.NullOrderGateway();
    let positionGateway = new HitBtcPositionGateway(config);
    if (config.GetString('HitBtcPullUrl').indexOf('demo') > -1) {
      positionGateway = new NullGateway.NullPositionGateway(pair);
    }
    super(new HitBtcMarketDataGateway(config, symbolProvider, step), orderGateway, positionGateway, details);
  }
}
function createHitBtc(config, pair) {
  return __awaiter(this, void 0, void 0, function* () {
    const symbolsUrl = config.GetString('HitBtcPullUrl') + '/api/1/public/symbols';
    const symbols = yield Utils.getJSON(symbolsUrl);
    const symbolProvider = new HitBtcSymbolProvider(pair);
    for (const s of symbols.symbols) {
      if (s.symbol === symbolProvider.symbol) { return new HitBtc(config, symbolProvider, parseFloat(s.step), pair); }
    }
    throw new Error('unable to match pair to a hitbtc symbol ' + pair.toString());
  });
}
exports.createHitBtc = createHitBtc;
// # sourceMappingURL=hitbtc.js.map
