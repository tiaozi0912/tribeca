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
const Q = require('q');
const crypto = require('crypto');
const request = require('request');
const NullGateway = require('./nullgw');
const Models = require('../../common/models');
const Utils = require('../utils');
const Interfaces = require('../interfaces');
const moment = require('moment');
const _ = require('lodash');
const logging_1 = require('../logging');
const shortId = require('shortid');
const Deque = require('collections/deque');
function decodeSide(side) {
  switch (side) {
    case 'buy': return Models.Side.Bid;
    case 'sell': return Models.Side.Ask;
    default: return Models.Side.Unknown;
  }
}
function encodeSide(side) {
  switch (side) {
    case Models.Side.Bid: return 'buy';
    case Models.Side.Ask: return 'sell';
    default: return '';
  }
}
function encodeTimeInForce(tif, type) {
  if (type === Models.OrderType.Market) {
    return 'exchange market';
  } else if (type === Models.OrderType.Limit) {
    if (tif === Models.TimeInForce.FOK) { return 'exchange fill-or-kill'; }
    if (tif === Models.TimeInForce.GTC) { return 'exchange limit'; }
  }
  throw new Error('unsupported tif ' + Models.TimeInForce[tif] + ' and order type ' + Models.OrderType[type]);
}
class BitfinexMarketDataGateway {
  constructor(timeProvider, _http, _symbolProvider) {
    this._http = _http;
    this._symbolProvider = _symbolProvider;
    this.ConnectChanged = new Utils.Evt();
    this._since = null;
    this.MarketTrade = new Utils.Evt();
    this.onTrades = trades => {
      _.forEach(trades.data, trade => {
        const px = parseFloat(trade.price);
        const sz = parseFloat(trade.amount);
        const time = moment.unix(trade.timestamp).toDate();
        const side = decodeSide(trade.type);
        const mt = new Models.GatewayMarketTrade(px, sz, time, this._since === null, side);
        this.MarketTrade.trigger(mt);
      });
      this._since = moment().unix();
    };
    this.downloadMarketTrades = () => {
      const qs = { timestamp: this._since === null ? moment.utc().subtract(60, 'seconds').unix() : this._since };
      this._http
        .get('trades/' + this._symbolProvider.symbol, qs)
        .then(this.onTrades)
        .done();
    };
    this.MarketData = new Utils.Evt();
    this.onMarketData = book => {
      const bids = BitfinexMarketDataGateway.ConvertToMarketSides(book.data.bids);
      const asks = BitfinexMarketDataGateway.ConvertToMarketSides(book.data.asks);
      this.MarketData.trigger(new Models.Market(bids, asks, book.time));
    };
    this.downloadMarketData = () => {
      this._http
        .get('book/' + this._symbolProvider.symbol, { limit_bids: 5, limit_asks: 5 })
        .then(this.onMarketData)
        .done();
    };
    timeProvider.setInterval(this.downloadMarketData, moment.duration(5, 'seconds'));
    timeProvider.setInterval(this.downloadMarketTrades, moment.duration(15, 'seconds'));
    this.downloadMarketData();
    this.downloadMarketTrades();
    _http.ConnectChanged.on(s => this.ConnectChanged.trigger(s));
  }
  static ConvertToMarketSide(level) {
    return new Models.MarketSide(parseFloat(level.price), parseFloat(level.amount));
  }
  static ConvertToMarketSides(level) {
    return _.map(level, BitfinexMarketDataGateway.ConvertToMarketSide);
  }
}
class BitfinexOrderEntryGateway {
  constructor(timeProvider, _details, _http, _symbolProvider) {
    this._details = _details;
    this._http = _http;
    this._symbolProvider = _symbolProvider;
    this.OrderUpdate = new Utils.Evt();
    this.ConnectChanged = new Utils.Evt();
    this.supportsCancelAllOpenOrders = () => { return false; };
    this.cancelAllOpenOrders = () => { return Q(0); };
    this.generateClientOrderId = () => shortId.generate();
    this.cancelsByClientOrderId = false;
    this.convertToOrderRequest = order => {
      return {
        amount: order.quantity.toString(),
        exchange: 'bitfinex',
        price: order.price.toString(),
        side: encodeSide(order.side),
        symbol: this._symbolProvider.symbol,
        type: encodeTimeInForce(order.timeInForce, order.type),
      };
    };
    this.sendOrder = order => {
      const req = this.convertToOrderRequest(order);
      this._http
        .post('order/new', req)
        .then(resp => {
          if (typeof resp.data.message !== 'undefined') {
            this.OrderUpdate.trigger({
              orderStatus: Models.OrderStatus.Rejected,
              orderId: order.orderId,
              rejectMessage: resp.data.message,
              time: resp.time,
            });
            return;
          }
          this.OrderUpdate.trigger({
            orderId: order.orderId,
            exchangeId: resp.data.order_id,
            time: resp.time,
            orderStatus: Models.OrderStatus.Working,
          });
        }).done();
      this.OrderUpdate.trigger({
        orderId: order.orderId,
        computationalLatency: Utils.fastDiff(new Date(), order.time),
      });
    };
    this.cancelOrder = cancel => {
      const req = { order_id: cancel.exchangeId };
      this._http
        .post('order/cancel', req)
        .then(resp => {
          if (typeof resp.data.message !== 'undefined') {
            this.OrderUpdate.trigger({
              orderStatus: Models.OrderStatus.Rejected,
              cancelRejected: true,
              orderId: cancel.orderId,
              rejectMessage: resp.data.message,
              time: resp.time,
            });
            return;
          }
          this.OrderUpdate.trigger({
            orderId: cancel.orderId,
            time: resp.time,
            orderStatus: Models.OrderStatus.Cancelled,
          });
        })
        .done();
      this.OrderUpdate.trigger({
        orderId: cancel.orderId,
        computationalLatency: Utils.fastDiff(new Date(), cancel.time),
      });
    };
    this.replaceOrder = replace => {
      this.cancelOrder(replace);
      this.sendOrder(replace);
    };
    this.downloadOrderStatuses = () => {
      const tradesReq = { timestamp: this._since.unix(), symbol: this._symbolProvider.symbol };
      this._http
        .post('mytrades', tradesReq)
        .then(resps => {
          _.forEach(resps.data, t => {
            this._http
              .post('order/status', { order_id: t.order_id })
              .then(r => {
                this.OrderUpdate.trigger({
                  exchangeId: t.order_id,
                  lastPrice: parseFloat(t.price),
                  lastQuantity: parseFloat(t.amount),
                  orderStatus: BitfinexOrderEntryGateway.GetOrderStatus(r.data),
                  averagePrice: parseFloat(r.data.avg_execution_price),
                  leavesQuantity: parseFloat(r.data.remaining_amount),
                  cumQuantity: parseFloat(r.data.executed_amount),
                  quantity: parseFloat(r.data.original_amount),
                });
              })
              .done();
          });
        }).done();
      this._since = moment.utc();
    };
    this._since = moment.utc();
    this._log = logging_1.default('tribeca:gateway:BitfinexOE');
    _http.ConnectChanged.on(s => this.ConnectChanged.trigger(s));
    timeProvider.setInterval(this.downloadOrderStatuses, moment.duration(8, 'seconds'));
  }
  static GetOrderStatus(r) {
    if (r.is_cancelled) { return Models.OrderStatus.Cancelled; }
    if (r.is_live) { return Models.OrderStatus.Working; }
    if (r.executed_amount === r.original_amount) { return Models.OrderStatus.Complete; }
    return Models.OrderStatus.Other;
  }
}
class RateLimitMonitor {
  constructor(_number, duration) {
    this._number = _number;
    this._log = logging_1.default('tribeca:gateway:rlm');
    this._queue = Deque();
    this.add = () => {
      const now = moment.utc();
      while (now.diff(this._queue.peek()) > this._durationMs) {
        this._queue.shift();
      }
      this._queue.push(now);
      if (this._queue.length > this._number) {
        this._log.error('Exceeded rate limit', { nRequests: this._queue.length, max: this._number, durationMs: this._durationMs });
      }
    };
    this._durationMs = duration.asMilliseconds();
  }
}
class BitfinexHttp {
  constructor(config, _monitor) {
    this._monitor = _monitor;
    this.ConnectChanged = new Utils.Evt();
    this._timeout = 15000;
    this.get = (actionUrl, qs) => {
      const url = this._baseUrl + '/' + actionUrl;
      const opts = {
        timeout: this._timeout,
        url,
        qs: qs || undefined,
        method: 'GET',
      };
      return this.doRequest(opts, url);
    };
    this.post = (actionUrl, msg) => {
      return this.postOnce(actionUrl, _.clone(msg)).then(resp => {
        const rejectMsg = (resp.data).message;
        if (typeof rejectMsg !== 'undefined' && rejectMsg.indexOf('Nonce is too small') > -1) { return this.post(actionUrl, _.clone(msg)); }
        return resp;
      });
    };
    this.postOnce = (actionUrl, msg) => {
      msg.request = '/v1/' + actionUrl;
      msg.nonce = this._nonce.toString();
      this._nonce += 1;
      const payload = new Buffer(JSON.stringify(msg)).toString('base64');
      const signature = crypto.createHmac('sha384', this._secret).update(payload).digest('hex');
      const url = this._baseUrl + '/' + actionUrl;
      const opts = {
        timeout: this._timeout,
        url,
        headers: {
          'X-BFX-APIKEY': this._apiKey,
          'X-BFX-PAYLOAD': payload,
          'X-BFX-SIGNATURE': signature,
        },
        method: 'POST',
      };
      return this.doRequest(opts, url);
    };
    this.doRequest = (msg, url) => {
      const d = Q.defer();
      this._monitor.add();
      request(msg, (err, resp, body) => {
        if (err) {
          this._log.error(err, 'Error returned: url=', url, 'err=', err);
          d.reject(err);
        } else {
          try {
            const t = new Date();
            const data = JSON.parse(body);
            d.resolve(new Models.Timestamped(data, t));
          } catch (err) {
            this._log.error(err, 'Error parsing JSON url=', url, 'err=', err, ', body=', body);
            d.reject(err);
          }
        }
      });
      return d.promise;
    };
    this._log = logging_1.default('tribeca:gateway:BitfinexHTTP');
    this._baseUrl = config.GetString('BitfinexHttpUrl');
    this._apiKey = config.GetString('BitfinexKey');
    this._secret = config.GetString('BitfinexSecret');
    this._nonce = new Date().valueOf();
    this._log.info('Starting nonce: ', this._nonce);
    setTimeout(() => this.ConnectChanged.trigger(Models.ConnectivityStatus.Connected), 10);
  }
}
class BitfinexPositionGateway {
  constructor(timeProvider, _http) {
    this._http = _http;
    this.PositionUpdate = new Utils.Evt();
    this.onRefreshPositions = () => {
      this._http.post('balances', {}).then(res => {
        _.forEach(_.filter(res.data, x => x.type === 'exchange'), p => {
          const amt = parseFloat(p.amount);
          const cur = Models.toCurrency(p.currency);
          const held = amt - parseFloat(p.available);
          const rpt = new Models.CurrencyPosition(amt, held, cur);
          this.PositionUpdate.trigger(rpt);
        });
      }).done();
    };
    this._log = logging_1.default('tribeca:gateway:BitfinexPG');
    timeProvider.setInterval(this.onRefreshPositions, moment.duration(15, 'seconds'));
    this.onRefreshPositions();
  }
}
class BitfinexBaseGateway {
  constructor(minTickIncrement) {
    this.minTickIncrement = minTickIncrement;
  }
  get hasSelfTradePrevention() {
    return false;
  }
  name() {
    return 'Bitfinex';
  }
  makeFee() {
    return 0.001;
  }
  takeFee() {
    return 0.002;
  }
  exchange() {
    return Models.Exchange.Bitfinex;
  }
}
class BitfinexSymbolProvider {
  constructor(pair) {
    this.symbol = Models.fromCurrency(pair.base).toLowerCase() + Models.fromCurrency(pair.quote).toLowerCase();
  }
}
class Bitfinex extends Interfaces.CombinedGateway {
  constructor(timeProvider, config, symbol, pricePrecision) {
    const monitor = new RateLimitMonitor(60, moment.duration(1, 'minutes'));
    const http = new BitfinexHttp(config, monitor);
    const details = new BitfinexBaseGateway(pricePrecision);
    const orderGateway = config.GetString('BitfinexOrderDestination') == 'Bitfinex'
      ? new BitfinexOrderEntryGateway(timeProvider, details, http, symbol)
      : new NullGateway.NullOrderGateway();
    super(new BitfinexMarketDataGateway(timeProvider, http, symbol), orderGateway, new BitfinexPositionGateway(timeProvider, http), details);
  }
}
function createBitfinex(timeProvider, config, pair) {
  return __awaiter(this, void 0, void 0, function* () {
    const detailsUrl = config.GetString('BitfinexHttpUrl') + '/symbols_details';
    const symbolDetails = yield Utils.getJSON(detailsUrl);
    const symbol = new BitfinexSymbolProvider(pair);
    for (const s of symbolDetails) {
      if (s.pair === symbol.symbol) { return new Bitfinex(timeProvider, config, symbol, Math.pow(10, (-1 * s.price_precision))); }
    }
    throw new Error('cannot match pair to a Bitfinex Symbol ' + pair.toString());
  });
}
exports.createBitfinex = createBitfinex;
// # sourceMappingURL=bitfinex.js.map
