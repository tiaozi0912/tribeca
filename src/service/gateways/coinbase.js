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
const NullGateway = require('./nullgw');
const Models = require('../../common/models');
const Utils = require('../utils');
const Interfaces = require('../interfaces');
const moment = require('moment');
const Q = require('q');
const _ = require('lodash');
const logging_1 = require('../logging');
const uuid = require('node-uuid');
const CoinbaseExchange = require('./coinbase-api');
const SortedArrayMap = require('collections/sorted-array-map');
function convertConnectivityStatus(s) {
  return s.new === 'processing' ? Models.ConnectivityStatus.Connected : Models.ConnectivityStatus.Disconnected;
}
function convertSide(msg) {
  return msg.side === 'buy' ? Models.Side.Bid : Models.Side.Ask;
}
function convertPrice(pxStr) {
  return parseFloat(pxStr);
}
function convertSize(szStr) {
  return parseFloat(szStr);
}
function convertTime(time) {
  return new Date(time);
}
class PriceLevel {
  constructor() {
    this.orders = {};
    this.marketUpdate = new Models.MarketSide(0, 0);
  }
}
class CoinbaseOrderBook {
  constructor(_minTick) {
    this._minTick = _minTick;
    this.Eq = (a, b) => Math.abs(a - b) < 0.5 * this._minTick;
    this.BidCmp = (a, b) => {
      if (this.Eq(a, b)) { return 0; }
      return a > b ? -1 : 1;
    };
    this.AskCmp = (a, b) => {
      if (this.Eq(a, b)) { return 0; }
      return a > b ? 1 : -1;
    };
    this.bids = new SortedArrayMap([], this.Eq, this.BidCmp);
    this.asks = new SortedArrayMap([], this.Eq, this.AskCmp);
    this.getStorage = side => {
      if (side === Models.Side.Bid) { return this.bids; }
      if (side === Models.Side.Ask) { return this.asks; }
    };
    this.addToOrderBook = (storage, price, size, order_id) => {
      let priceLevelStorage = storage.get(price);
      if (typeof priceLevelStorage === 'undefined') {
        const pl = new PriceLevel();
        pl.marketUpdate.price = price;
        priceLevelStorage = pl;
        storage.set(price, pl);
      }
      priceLevelStorage.marketUpdate.size += size;
      priceLevelStorage.orders[order_id] = size;
    };
    this.onReceived = (msg, t) => {
      if (msg.order_type == 'market') {
        return;
      }
      const price = convertPrice(msg.price);
      const size = convertSize(msg.size);
      const side = convertSide(msg);
      const otherSide = side === Models.Side.Bid ? Models.Side.Ask : Models.Side.Bid;
      const storage = this.getStorage(otherSide);
      let changed = false;
      let remaining_size = size;
      for (let i = 0; i < storage.store.length; i++) {
        if (remaining_size <= 0) { break; }
        const kvp = storage.store.array[i];
        const price_level = kvp.key;
        if (side === Models.Side.Bid && price < price_level) { break; }
        if (side === Models.Side.Ask && price > price_level) { break; }
        const level_size = kvp.value.marketUpdate.size;
        if (level_size <= remaining_size) {
          storage.delete(price_level);
          remaining_size -= level_size;
          changed = true;
        }
      }
      return changed;
    };
    this.onOpen = (msg, t) => {
      const price = convertPrice(msg.price);
      const side = convertSide(msg);
      const storage = this.getStorage(side);
      this.addToOrderBook(storage, price, convertSize(msg.remaining_size), msg.order_id);
    };
    this.onDone = (msg, t) => {
      const price = convertPrice(msg.price);
      const side = convertSide(msg);
      const storage = this.getStorage(side);
      const priceLevelStorage = storage.get(price);
      if (typeof priceLevelStorage === 'undefined') { return false; }
      const orderSize = priceLevelStorage.orders[msg.order_id];
      if (typeof orderSize === 'undefined') { return false; }
      priceLevelStorage.marketUpdate.size -= orderSize;
      delete priceLevelStorage.orders[msg.order_id];
      if (_.isEmpty(priceLevelStorage.orders)) {
        storage.delete(price);
      }
      return true;
    };
    this.onMatch = (msg, t) => {
      const price = convertPrice(msg.price);
      const size = convertSize(msg.size);
      const side = convertSide(msg);
      const makerStorage = this.getStorage(side);
      const priceLevelStorage = makerStorage.get(price);
      if (typeof priceLevelStorage !== 'undefined') {
        priceLevelStorage.marketUpdate.size -= size;
        priceLevelStorage.orders[msg.maker_order_id] -= size;
        if (priceLevelStorage.orders[msg.maker_order_id] < 1e-4) { delete priceLevelStorage.orders[msg.maker_order_id]; }
        if (_.isEmpty(priceLevelStorage.orders)) {
          makerStorage.delete(price);
        }
        return true;
      }
      return false;
    };
    this.onChange = (msg, t) => {
      const price = convertPrice(msg.price);
      const side = convertSide(msg);
      const storage = this.getStorage(side);
      const priceLevelStorage = storage.get(convertPrice(msg.price));
      if (typeof priceLevelStorage === 'undefined') { return false; }
      const oldSize = priceLevelStorage.orders[msg.order_id];
      if (typeof oldSize === 'undefined') { return false; }
      const newSize = convertSize(msg.new_size);
      priceLevelStorage.orders[msg.order_id] = newSize;
      priceLevelStorage.marketUpdate.size -= (oldSize - newSize);
      return true;
    };
    this.clear = () => {
      this.asks.clear();
      this.bids.clear();
    };
    this.initialize = book => {
      const add = (st, u) => this.addToOrderBook(st, convertPrice(u.price), convertSize(u.size), u.id);
      _.forEach(book.asks, a => add(this.asks, a));
      _.forEach(book.bids, b => add(this.bids, b));
    };
  }
}
class CoinbaseMarketDataGateway {
  constructor(_orderBook, _client, _timeProvider) {
    this._orderBook = _orderBook;
    this._client = _client;
    this._timeProvider = _timeProvider;
    this.MarketData = new Utils.Evt();
    this.MarketTrade = new Utils.Evt();
    this.ConnectChanged = new Utils.Evt();
    this.onReceived = (msg, t) => {
      if (this._orderBook.onReceived(msg, t)) {
        this.reevalBids();
        this.reevalAsks();
        this.raiseMarketData(t);
      }
    };
    this.onOpen = (msg, t) => {
      const price = convertPrice(msg.price);
      const side = convertSide(msg);
      this._orderBook.onOpen(msg, t);
      this.onOrderBookChanged(t, side, price);
    };
    this.onDone = (msg, t) => {
      const price = convertPrice(msg.price);
      const side = convertSide(msg);
      if (this._orderBook.onDone(msg, t)) {
        this.onOrderBookChanged(t, side, price);
      }
    };
    this.onMatch = (msg, t) => {
      const price = convertPrice(msg.price);
      const size = convertSize(msg.size);
      const side = convertSide(msg);
      if (this._orderBook.onMatch(msg, t)) {
        this.onOrderBookChanged(t, side, price);
      }
      this.MarketTrade.trigger(new Models.GatewayMarketTrade(price, size, convertTime(msg.time), false, side));
    };
    this.onChange = (msg, t) => {
      const price = convertPrice(msg.price);
      const side = convertSide(msg);
      if (this._orderBook.onChange(msg, t)) {
        this.onOrderBookChanged(t, side, price);
      }
    };
    this._cachedBids = null;
    this._cachedAsks = null;
    this.Depth = 25;
    this.reevalBids = () => {
      this._cachedBids = _.map(this._orderBook.bids.store.slice(0, this.Depth), s => s.value.marketUpdate);
    };
    this.reevalAsks = () => {
      this._cachedAsks = _.map(this._orderBook.asks.store.slice(0, this.Depth), s => s.value.marketUpdate);
    };
    this.onOrderBookChanged = (t, side, price) => {
      if (side === Models.Side.Bid) {
        if (this._cachedBids.length > 0 && price < _.last(this._cachedBids).price) { return; }
        this.reevalBids();
      }
      if (side === Models.Side.Ask) {
        if (this._cachedAsks.length > 0 && price > _.last(this._cachedAsks).price) { return; }
        this.reevalAsks();
      }
      this.raiseMarketData(t);
    };
    this.onStateChange = s => {
      const t = this._timeProvider.utcNow();
      const status = convertConnectivityStatus(s);
      if (status === Models.ConnectivityStatus.Connected) {
        this._orderBook.initialize(this._client.book);
      } else {
        this._orderBook.clear();
      }
      this.ConnectChanged.trigger(status);
      this.reevalBids();
      this.reevalAsks();
      this.raiseMarketData(t);
    };
    this.raiseMarketData = t => {
      if (typeof this._cachedBids[0] !== 'undefined' && typeof this._cachedAsks[0] !== 'undefined') {
        if (this._cachedBids[0].price > this._cachedAsks[0].price) {
          this._log.warn('Crossed Coinbase market detected! bid:', this._cachedBids[0].price, 'ask:', this._cachedAsks[0].price);
          this._client.changeState('error');
          return;
        }
        this.MarketData.trigger(new Models.Market(this._cachedBids, this._cachedAsks, t));
      }
    };
    this._log = logging_1.default('tribeca:gateway:CoinbaseMD');
    this._client.on('statechange', m => this.onStateChange(m));
    this._client.on('received', m => this.onReceived(m.data, m.time));
    this._client.on('open', m => this.onOpen(m.data, m.time));
    this._client.on('done', m => this.onDone(m.data, m.time));
    this._client.on('match', m => this.onMatch(m.data, m.time));
    this._client.on('change', m => this.onChange(m.data, m.time));
  }
}
class CoinbaseOrderEntryGateway {
  constructor(minTick, _timeProvider, _orderData, _orderBook, _authClient, _symbolProvider) {
    this._timeProvider = _timeProvider;
    this._orderData = _orderData;
    this._orderBook = _orderBook;
    this._authClient = _authClient;
    this._symbolProvider = _symbolProvider;
    this.OrderUpdate = new Utils.Evt();
    this.supportsCancelAllOpenOrders = () => { return false; };
    this.cancelAllOpenOrders = () => {
      const d = Q.defer();
      this._authClient.cancelAllOrders((err, resp) => {
        if (err) { d.reject(err); } else {
          const t = this._timeProvider.utcNow();
          for (const cxl_id of resp) {
            this.OrderUpdate.trigger({
              exchangeId: cxl_id,
              time: t,
              orderStatus: Models.OrderStatus.Cancelled,
              leavesQuantity: 0,
            });
          }
          d.resolve(resp.length);
        }

      });
      return d.promise;
    };
    this.generateClientOrderId = () => {
      return uuid.v1();
    };
    this.cancelOrder = cancel => {
      this._authClient.cancelOrder(cancel.exchangeId, (err, resp, ack) => {
        let status;
        const t = this._timeProvider.utcNow();
        let msg = null;
        if (err) {
          if (err.message) { msg = err.message; }
        } else if (ack != null) {
          if (ack.message) { msg = ack.message; }
          if (ack.error) { msg = ack.error; }
        }
        if (msg !== null) {
          status = {
            orderId: cancel.orderId,
            rejectMessage: msg,
            orderStatus: Models.OrderStatus.Rejected,
            cancelRejected: true,
            time: t,
            leavesQuantity: 0,
          };
          if (msg === 'You have exceeded your request rate of 5 r/s.' || msg === 'BadRequest') {
            this._timeProvider.setTimeout(() => this.cancelOrder(cancel), moment.duration(500));
          }
        } else {
          status = {
            orderId: cancel.orderId,
            orderStatus: Models.OrderStatus.Cancelled,
            time: t,
            leavesQuantity: 0,
          };
        }
        this.OrderUpdate.trigger(status);
      });
      this.OrderUpdate.trigger({
        orderId: cancel.orderId,
        computationalLatency: Utils.fastDiff(new Date(), cancel.time),
      });
    };
    this.replaceOrder = replace => {
      this.cancelOrder(replace);
      this.sendOrder(replace);
    };
    this.sendOrder = order => {
      const cb = (err, resp, ack) => {
        let status;
        const t = this._timeProvider.utcNow();
        if (ack == null || typeof ack.id === 'undefined') {
          this._log.warn('NO EXCHANGE ID PROVIDED FOR ORDER ID:', order.orderId, err, ack);
        }
        let msg = null;
        if (err) {
          if (err.message) { msg = err.message; }
        } else if (ack != null) {
          if (ack.message) { msg = ack.message; }
          if (ack.error) { msg = ack.error; }
        } else if (ack == null) {
          msg = 'No ack provided!!';
        }
        if (msg !== null) {
          status = {
            orderId: order.orderId,
            rejectMessage: msg,
            orderStatus: Models.OrderStatus.Rejected,
            time: t,
          };
        } else {
          status = {
            exchangeId: ack.id,
            orderId: order.orderId,
            orderStatus: Models.OrderStatus.Working,
            time: t,
          };
        }
        this.OrderUpdate.trigger(status);
      };
      const o = {
        client_oid: order.orderId,
        size: order.quantity.toString(),
        product_id: this._symbolProvider.symbol,
      };
      if (order.type === Models.OrderType.Limit) {
        o.price = order.price.toFixed(this._fixedPrecision);
        if (order.preferPostOnly) { o.post_only = true; }
        switch (order.timeInForce) {
          case Models.TimeInForce.GTC:
            break;
          case Models.TimeInForce.FOK:
            o.time_in_force = 'FOK';
            break;
          case Models.TimeInForce.IOC:
            o.time_in_force = 'IOC';
            break;
        }
      } else if (order.type === Models.OrderType.Market) {
        o.type = 'market';
      }
      if (order.side === Models.Side.Bid) { this._authClient.buy(o, cb); } else if (order.side === Models.Side.Ask) { this._authClient.sell(o, cb); }
      this.OrderUpdate.trigger({
        orderId: order.orderId,
        computationalLatency: Utils.fastDiff(new Date(), order.time),
      });
    };
    this.cancelsByClientOrderId = false;
    this.ConnectChanged = new Utils.Evt();
    this.onStateChange = s => {
      const status = convertConnectivityStatus(s);
      this.ConnectChanged.trigger(status);
    };
    this.onReceived = tsMsg => {
      const msg = tsMsg.data;
      if (typeof msg.client_oid === 'undefined' || !this._orderData.allOrders.has(msg.client_oid)) { return; }
      const status = {
        exchangeId: msg.order_id,
        orderId: msg.client_oid,
        orderStatus: Models.OrderStatus.Working,
        time: tsMsg.time,
        leavesQuantity: convertSize(msg.size),
      };
      this.OrderUpdate.trigger(status);
    };
    this.onOpen = tsMsg => {
      const msg = tsMsg.data;
      const orderId = this._orderData.exchIdsToClientIds.get(msg.order_id);
      if (typeof orderId === 'undefined') { return; }
      const t = this._timeProvider.utcNow();
      const status = {
        orderId,
        orderStatus: Models.OrderStatus.Working,
        time: tsMsg.time,
        leavesQuantity: convertSize(msg.remaining_size),
      };
      this.OrderUpdate.trigger(status);
    };
    this.onDone = tsMsg => {
      const msg = tsMsg.data;
      const orderId = this._orderData.exchIdsToClientIds.get(msg.order_id);
      if (typeof orderId === 'undefined') { return; }
      const ordStatus = msg.reason === 'filled'
        ? Models.OrderStatus.Complete
        : Models.OrderStatus.Cancelled;
      const status = {
        orderId,
        orderStatus: ordStatus,
        time: tsMsg.time,
        leavesQuantity: 0,
      };
      this.OrderUpdate.trigger(status);
    };
    this.onMatch = tsMsg => {
      const msg = tsMsg.data;
      let liq = Models.Liquidity.Make;
      let client_oid = this._orderData.exchIdsToClientIds.get(msg.maker_order_id);
      if (typeof client_oid === 'undefined') {
        liq = Models.Liquidity.Take;
        client_oid = this._orderData.exchIdsToClientIds.get(msg.taker_order_id);
      }
      if (typeof client_oid === 'undefined') { return; }
      const status = {
        orderId: client_oid,
        orderStatus: Models.OrderStatus.Working,
        time: tsMsg.time,
        lastQuantity: convertSize(msg.size),
        lastPrice: convertPrice(msg.price),
        liquidity: liq,
      };
      this.OrderUpdate.trigger(status);
    };
    this.onChange = tsMsg => {
      const msg = tsMsg.data;
      const orderId = this._orderData.exchIdsToClientIds.get(msg.order_id);
      if (typeof orderId === 'undefined') { return; }
      const status = {
        orderId,
        orderStatus: Models.OrderStatus.Working,
        time: tsMsg.time,
        quantity: convertSize(msg.new_size),
      };
      this.OrderUpdate.trigger(status);
    };
    this._log = logging_1.default('tribeca:gateway:CoinbaseOE');
    this._fixedPrecision = -1 * Math.floor(Math.log10(minTick));
    this._orderBook.on('statechange', this.onStateChange);
    this._orderBook.on('received', this.onReceived);
    this._orderBook.on('open', this.onOpen);
    this._orderBook.on('done', this.onDone);
    this._orderBook.on('match', this.onMatch);
    this._orderBook.on('change', this.onChange);
  }
}
class CoinbasePositionGateway {
  constructor(timeProvider, _authClient) {
    this._authClient = _authClient;
    this._log = logging_1.default('tribeca:gateway:CoinbasePG');
    this.PositionUpdate = new Utils.Evt();
    this.onTick = () => {
      this._authClient.getAccounts((err, resp, data) => {
        try {
          if (Array.isArray(data)) {
            _.forEach(data, d => {
              const c = Models.toCurrency(d.currency);
              const rpt = new Models.CurrencyPosition(convertPrice(d.available), convertPrice(d.hold), c);
              this.PositionUpdate.trigger(rpt);
            });
          } else {
            this._log.warn('Unable to get Coinbase positions', data);
          }
        } catch (error) {
          this._log.error(error, 'Exception while downloading Coinbase positions', data);
        }
      });
    };
    timeProvider.setInterval(this.onTick, moment.duration(7500));
    this.onTick();
  }
}
class CoinbaseBaseGateway {
  constructor(minTickIncrement) {
    this.minTickIncrement = minTickIncrement;
  }
  get hasSelfTradePrevention() {
    return true;
  }
  exchange() {
    return Models.Exchange.Coinbase;
  }
  makeFee() {
    return 0;
  }
  takeFee() {
    return 0;
  }
  name() {
    return 'Coinbase';
  }
}
class CoinbaseSymbolProvider {
  constructor(pair) {
    this.symbol = Models.fromCurrency(pair.base) + '-' + Models.fromCurrency(pair.quote);
  }
}
class Coinbase extends Interfaces.CombinedGateway {
  constructor(authClient, config, orders, timeProvider, symbolProvider, quoteIncrement) {
    const orderEventEmitter = new CoinbaseExchange.OrderBook(symbolProvider.symbol, config.GetString('CoinbaseWebsocketUrl'), config.GetString('CoinbaseRestUrl'), timeProvider);
    const orderGateway = config.GetString('CoinbaseOrderDestination') == 'Coinbase' ?
      new CoinbaseOrderEntryGateway(quoteIncrement, timeProvider, orders, orderEventEmitter, authClient, symbolProvider)
      : new NullGateway.NullOrderGateway();
    const positionGateway = new CoinbasePositionGateway(timeProvider, authClient);
    const mdGateway = new CoinbaseMarketDataGateway(new CoinbaseOrderBook(quoteIncrement), orderEventEmitter, timeProvider);
    super(mdGateway, orderGateway, positionGateway, new CoinbaseBaseGateway(quoteIncrement));
  }
}

function createCoinbase(config, orders, timeProvider, pair) {
  return __awaiter(this, void 0, void 0, function* () {
    const authClient = new CoinbaseExchange.AuthenticatedClient(config.GetString('CoinbaseApiKey'), config.GetString('CoinbaseSecret'), config.GetString('CoinbasePassphrase'), config.GetString('CoinbaseRestUrl'));
    const d = Q.defer();
    authClient.getProducts((err, _, p) => {
      if (err) { d.reject(err); } else { d.resolve(p); }
    });
    const products = yield d.promise;
    const symbolProvider = new CoinbaseSymbolProvider(pair);
    for (const p of products) {
      if (p.id === symbolProvider.symbol) { return new Coinbase(authClient, config, orders, timeProvider, symbolProvider, parseFloat(p.quote_increment)); }
    }
    throw new Error('unable to match pair to a coinbase symbol ' + pair.toString());
  });
}
exports.createCoinbase = createCoinbase;
// # sourceMappingURL=coinbase.js.map
