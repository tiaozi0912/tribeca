'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const Models = require('../common/models');
const Utils = require('./utils');
const Interfaces = require('./interfaces');
const moment = require('moment');
const _ = require('lodash');
const fs = require('fs');
const Q = require('q');
const shortId = require('shortid');
const Deque = require('collections/deque');
const uuid = require('node-uuid');
let TimedType;
(function(TimedType) {
  TimedType[TimedType.Interval = 0] = 'Interval';
  TimedType[TimedType.Timeout = 1] = 'Timeout';
})(TimedType || (TimedType = {}));
class Timed {
  constructor(action, time, type, interval) {
    this.action = action;
    this.time = time;
    this.type = type;
    this.interval = interval;
  }
}
class BacktestTimeProvider {
  constructor(_internalTime, _endTime) {
    this._internalTime = _internalTime;
    this._endTime = _endTime;
    this.utcNow = () => this._internalTime.toDate();
    this._immediates = new Array();
    this.setImmediate = action => this._immediates.push(action);
    this._timeouts = [];
    this.setTimeout = (action, time) => {
      this.setAction(action, time, TimedType.Timeout);
    };
    this.setInterval = (action, time) => {
      this.setAction(action, time, TimedType.Interval);
    };
    this.setAction = (action, time, type) => {
      const dueTime = this._internalTime.clone().add(time);
      if (Utils.fastDiff(dueTime.toDate(), this.utcNow()) < 0) {
        return;
      }
      this._timeouts.push(new Timed(action, dueTime, type, time));
      this._timeouts.sort((a, b) => Utils.fastDiff(a.time.toDate(), b.time.toDate()));
    };
    this.scrollTimeTo = time => {
      if (Utils.fastDiff(time.toDate(), this.utcNow()) < 0) {
        throw new Error('Cannot reverse time!');
      }
      while (this._immediates.length > 0) {
        this._immediates.pop()();
      }
      while (this._timeouts.length > 0 && Utils.fastDiff(_.first(this._timeouts).time.toDate(), time.toDate()) < 0) {
        const evt = this._timeouts.shift();
        this._internalTime = evt.time;
        evt.action();
        if (evt.type === TimedType.Interval) {
          this.setAction(evt.action, evt.interval, evt.type);
        }
      }
      this._internalTime = time;
    };
  }
}
exports.BacktestTimeProvider = BacktestTimeProvider;
class BacktestGateway {
  constructor(_inputData, _baseAmount, _quoteAmount, timeProvider) {
    this._inputData = _inputData;
    this._baseAmount = _baseAmount;
    this._quoteAmount = _quoteAmount;
    this.timeProvider = timeProvider;
    this.ConnectChanged = new Utils.Evt();
    this.MarketData = new Utils.Evt();
    this.MarketTrade = new Utils.Evt();
    this.OrderUpdate = new Utils.Evt();
    this.supportsCancelAllOpenOrders = () => { return false; };
    this.cancelAllOpenOrders = () => { return Q(0); };
    this.generateClientOrderId = () => {
      return 'BACKTEST-' + shortId.generate();
    };
    this.cancelsByClientOrderId = true;
    this._openBidOrders = {};
    this._openAskOrders = {};
    this.sendOrder = order => {
      this.timeProvider.setTimeout(() => {
        if (order.side === Models.Side.Bid) {
          this._openBidOrders[order.orderId] = order;
          this._quoteHeld += order.price * order.quantity;
          this._quoteAmount -= order.price * order.quantity;
        } else {
          this._openAskOrders[order.orderId] = order;
          this._baseHeld += order.quantity;
          this._baseAmount -= order.quantity;
        }
        this.OrderUpdate.trigger({ orderId: order.orderId, orderStatus: Models.OrderStatus.Working });
      }, moment.duration(3));
    };
    this.cancelOrder = cancel => {
      this.timeProvider.setTimeout(() => {
        if (cancel.side === Models.Side.Bid) {
          var existing = this._openBidOrders[cancel.orderId];
          if (typeof existing === 'undefined') {
            this.OrderUpdate.trigger({ orderId: cancel.orderId, orderStatus: Models.OrderStatus.Rejected });
            return;
          }
          this._quoteHeld -= existing.price * existing.quantity;
          this._quoteAmount += existing.price * existing.quantity;
          delete this._openBidOrders[cancel.orderId];
        } else {
          var existing = this._openAskOrders[cancel.orderId];
          if (typeof existing === 'undefined') {
            this.OrderUpdate.trigger({ orderId: cancel.orderId, orderStatus: Models.OrderStatus.Rejected });
            return;
          }
          this._baseHeld -= existing.quantity;
          this._baseAmount += existing.quantity;
          delete this._openAskOrders[cancel.orderId];
        }
        this.OrderUpdate.trigger({ orderId: cancel.orderId, orderStatus: Models.OrderStatus.Cancelled });
      }, moment.duration(3));
    };
    this.replaceOrder = replace => {
      this.cancelOrder(replace);
      this.sendOrder(replace);
    };
    this.onMarketData = market => {
      this._openAskOrders = this.tryToMatch(_.values(this._openAskOrders), market.bids, Models.Side.Ask);
      this._openBidOrders = this.tryToMatch(_.values(this._openBidOrders), market.asks, Models.Side.Bid);
      this.MarketData.trigger(market);
    };
    this.tryToMatch = (orders, marketSides, side) => {
      if (orders.length === 0 || marketSides.length === 0) { return _.keyBy(orders, k => k.orderId); }
      const cmp = side === Models.Side.Ask ? (m, o) => o < m : (m, o) => o > m;
      _.forEach(orders, order => {
        _.forEach(marketSides, mkt => {
          if ((cmp(mkt.price, order.price) || order.type === Models.OrderType.Market) && order.quantity > 0) {
            let px = order.price;
            if (order.type === Models.OrderType.Market) { px = mkt.price; }
            const update = { orderId: order.orderId, lastPrice: px };
            if (mkt.size >= order.quantity) {
              update.orderStatus = Models.OrderStatus.Complete;
              update.lastQuantity = order.quantity;
            } else {
              update.partiallyFilled = true;
              update.orderStatus = Models.OrderStatus.Working;
              update.lastQuantity = mkt.size;
            }
            this.OrderUpdate.trigger(update);
            if (side === Models.Side.Bid) {
              this._baseAmount += update.lastQuantity;
              this._quoteHeld -= (update.lastQuantity * px);
            } else {
              this._baseHeld -= update.lastQuantity;
              this._quoteAmount += (update.lastQuantity * px);
            }
            order.quantity = order.quantity - update.lastQuantity;
          }

        });
      });
      const liveOrders = _.filter(orders, o => o.quantity > 0);
      if (liveOrders.length > 5) { console.warn('more than 5 outstanding ' + Models.Side[side] + ' orders open'); }
      return _.keyBy(liveOrders, k => k.orderId);
    };
    this.onMarketTrade = trade => {
      this._openAskOrders = this.tryToMatch(_.values(this._openAskOrders), [ trade ], Models.Side.Ask);
      this._openBidOrders = this.tryToMatch(_.values(this._openBidOrders), [ trade ], Models.Side.Bid);
      this.MarketTrade.trigger(new Models.GatewayMarketTrade(trade.price, trade.size, trade.time, false, trade.make_side));
    };
    this.PositionUpdate = new Utils.Evt();
    this.recomputePosition = () => {
      this.PositionUpdate.trigger(new Models.CurrencyPosition(this._baseAmount, this._baseHeld, Models.Currency.BTC));
      this.PositionUpdate.trigger(new Models.CurrencyPosition(this._quoteAmount, this._quoteHeld, Models.Currency.USD));
    };
    this._baseHeld = 0;
    this._quoteHeld = 0;
    this.run = () => {
      this.ConnectChanged.trigger(Models.ConnectivityStatus.Connected);
      let hasProcessedMktData = false;
      this.timeProvider.setInterval(() => this.recomputePosition(), moment.duration(15, 'seconds'));
      _(this._inputData).forEach(i => {
        this.timeProvider.scrollTimeTo(moment(i.time));
        if (typeof i.make_side !== 'undefined') {
          this.onMarketTrade(i);
        } else if (typeof i.bids !== 'undefined' || typeof i.asks !== 'undefined') {
          this.onMarketData(i);
          if (!hasProcessedMktData) {
            this.recomputePosition();
            hasProcessedMktData = true;
          }
        }
      });
      this.recomputePosition();
    };
  }
}
exports.BacktestGateway = BacktestGateway;
class BacktestGatewayDetails {
  constructor() {
    this.minTickIncrement = 0.01;
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
class BacktestParameters {
}
exports.BacktestParameters = BacktestParameters;
class BacktestPersister {
  constructor(initialData) {
    this.initialData = initialData;
    this.load = (exchange, pair, limit) => {
      return this.loadAll(limit);
    };
    this.loadAll = limit => {
      return new Promise(() => {
        if (this.initialData) {
          if (limit) {
            return _.takeRight(this.initialData, limit);
          }

          return this.initialData;

        }
        return [];
      });
    };
    this.persist = report => { };
    this.loadLatest = () => {
      if (this.initialData) { return new Promise(() => _.last(this.initialData)); }
    };
    this.initialData = initialData || null;
  }
}
exports.BacktestPersister = BacktestPersister;
class BacktestExchange extends Interfaces.CombinedGateway {
  constructor(gw) {
    super(gw, gw, gw, new BacktestGatewayDetails());
    this.gw = gw;
    this.run = () => this.gw.run();
  }
}
exports.BacktestExchange = BacktestExchange;

const express = require('express');
const util = require('util');
const backtestServer = () => {
  [ 'uncaughtException', 'exit', 'SIGINT', 'SIGTERM' ].forEach(reason => {
    process.on(reason, e => {
      console.log(util.format('Terminating!', reason, e, (typeof e !== 'undefined' ? e.stack : undefined)));
      process.exit(1);
    });
  });
  const mdFile = process.env.MD_FILE;
  const paramFile = process.env.PARAM_FILE;
  const savedProgressFile = process.env.PROGRESS_FILE || 'nextParameters_saved.txt';
  const backtestResultFile = process.env.RESULT_FILE || 'backtestResults.txt';
  const rawParams = fs.readFileSync(paramFile, 'utf8');
  let parameters = JSON.parse(rawParams);
  if (fs.existsSync(savedProgressFile)) {
    const l = parseInt(fs.readFileSync(savedProgressFile, 'utf8'));
    parameters = _.takeRight(parameters, l);
  } else if (fs.existsSync(backtestResultFile)) {
    fs.unlinkSync(backtestResultFile);
  }
  console.log('loaded input data...');
  const app = express();
  app.use(require('body-parser').json({ limit: '200mb' }));
  app.use(require('compression')());
  var server = app.listen(5001, () => {
    const host = server.address().address;
    const port = server.address().port;
    console.log('Backtest server listening at http://%s:%s', host, port);
  });
  app.get('/inputData', (req, res) => {
    console.log('Starting inputData download for', req.ip);
    res.sendFile(mdFile, err => {
      if (err) { console.error('Error while transmitting input data to', req.ip); } else { console.log('Ending inputData download for', req.ip); }
    });
  });
  app.get('/nextParameters', (req, res) => {
    if (_.some(parameters)) {
      const id = parameters.length;
      const served = parameters.shift();
      if (typeof served.id === 'undefined') { served.id = id.toString(); }
      console.log('Serving parameters id =', served.id, ' to', req.ip);
      res.json(served);
      fs.writeFileSync(savedProgressFile, parameters.length, { encoding: 'utf8' });
      if (!_.some(parameters)) {
        console.log('Done serving parameters');
      }
    } else {
      res.json('done');
      if (fs.existsSync(savedProgressFile)) { fs.unlinkSync(savedProgressFile); }
    }
  });
  app.post('/result', (req, res) => {
    const params = req.body;
    console.log('Accept backtest results, volume =', params[2].volume.toFixed(2), 'val =', params[1].value.toFixed(2), 'qVal =', params[1].quoteValue.toFixed(2));
    fs.appendFileSync(backtestResultFile, JSON.stringify(params) + '\n');
  });
};
if (process.argv[1].indexOf('backtest.js') > 1) {
  backtestServer();
}
// # sourceMappingURL=backtest.js.map
