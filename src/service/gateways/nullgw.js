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
const _ = require('lodash');
const Q = require('q');
const Models = require('../../common/models');
const Utils = require('../utils');
const Interfaces = require('../interfaces');
const uuid = require('node-uuid');
class NullOrderGateway {
  constructor() {
    this.OrderUpdate = new Utils.Evt();
    this.ConnectChanged = new Utils.Evt();
    this.supportsCancelAllOpenOrders = () => { return false; };
    this.cancelAllOpenOrders = () => { return Q(0); };
    this.cancelsByClientOrderId = true;
    this.generateClientOrderId = () => {
      return uuid.v1();
    };
    this.raiseTimeEvent = o => {
      this.OrderUpdate.trigger({
        orderId: o.orderId,
        computationalLatency: Utils.fastDiff(Utils.date(), o.time),
      });
    };
    setTimeout(() => this.ConnectChanged.trigger(Models.ConnectivityStatus.Connected), 500);
  }
  sendOrder(order) {
    if (order.timeInForce == Models.TimeInForce.IOC) { throw new Error('Cannot send IOCs'); }
    setTimeout(() => this.trigger(order.orderId, Models.OrderStatus.Working, order), 10);
    this.raiseTimeEvent(order);
  }
  cancelOrder(cancel) {
    setTimeout(() => this.trigger(cancel.orderId, Models.OrderStatus.Complete), 10);
    this.raiseTimeEvent(cancel);
  }
  replaceOrder(replace) {
    this.cancelOrder(replace);
    this.sendOrder(replace);
  }
  trigger(orderId, status, order) {
    var rpt = {
      orderId,
      orderStatus: status,
      time: Utils.date(),
    };
    this.OrderUpdate.trigger(rpt);
    if (status === Models.OrderStatus.Working && Math.random() < 0.1) {
      var rpt = {
        orderId,
        orderStatus: status,
        time: Utils.date(),
        lastQuantity: order.quantity,
        lastPrice: order.price,
        liquidity: Math.random() < 0.5 ? Models.Liquidity.Make : Models.Liquidity.Take,
      };
      setTimeout(() => this.OrderUpdate.trigger(rpt), 1000);
    }
  }
}
exports.NullOrderGateway = NullOrderGateway;
class NullPositionGateway {
  constructor(pair) {
    this.PositionUpdate = new Utils.Evt();
    setInterval(() => this.PositionUpdate.trigger(new Models.CurrencyPosition(500, 50, pair.base)), 2500);
    setInterval(() => this.PositionUpdate.trigger(new Models.CurrencyPosition(500, 50, pair.quote)), 2500);
  }
}
exports.NullPositionGateway = NullPositionGateway;
class NullMarketDataGateway {
  constructor(_minTick) {
    this._minTick = _minTick;
    this.MarketData = new Utils.Evt();
    this.ConnectChanged = new Utils.Evt();
    this.MarketTrade = new Utils.Evt();
    this.getPrice = sign => Utils.roundNearest(1000 + sign * 100 * Math.random(), this._minTick);
    this.genMarketTrade = () => {
      const side = (Math.random() > 0.5 ? Models.Side.Bid : Models.Side.Ask);
      const sign = Models.Side.Ask === side ? 1 : -1;
      return new Models.GatewayMarketTrade(this.getPrice(sign), Math.random(), Utils.date(), false, side);
    };
    this.genSingleLevel = sign => new Models.MarketSide(this.getPrice(sign), Math.random());
    this.Depth = 25;
    this.generateMarketData = () => {
      const genSide = sign => {
        const s = _.times(this.Depth, _ => this.genSingleLevel(sign));
        return _.sortBy(s, i => sign * i.price);
      };
      return new Models.Market(genSide(-1), genSide(1), Utils.date());
    };
    setTimeout(() => this.ConnectChanged.trigger(Models.ConnectivityStatus.Connected), 500);
    setInterval(() => this.MarketData.trigger(this.generateMarketData()), 5000 * Math.random());
    setInterval(() => this.MarketTrade.trigger(this.genMarketTrade()), 15000);
  }
}
exports.NullMarketDataGateway = NullMarketDataGateway;
class NullGatewayDetails {
  constructor(minTickIncrement) {
    this.minTickIncrement = minTickIncrement;
  }
  get hasSelfTradePrevention() {
    return false;
  }
  name() {
    return 'Null';
  }
  makeFee() {
    return 0;
  }
  takeFee() {
    return 0;
  }
  exchange() {
    return Models.Exchange.Null;
  }
}
class NullGateway extends Interfaces.CombinedGateway {
  constructor(config, pair) {
    const minTick = config.GetNumber('NullGatewayTick');
    super(new NullMarketDataGateway(minTick), new NullOrderGateway(), new NullPositionGateway(pair), new NullGatewayDetails(minTick));
  }
}
function createNullGateway(config, pair) {
  return __awaiter(this, void 0, void 0, function* () {
    return new NullGateway(config, pair);
  });
}
exports.createNullGateway = createNullGateway;
// # sourceMappingURL=nullgw.js.map
