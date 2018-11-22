'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const util = require('util');
const crypto = require('crypto');
const _ = require('lodash');
const request = require('request');
const Models = require('../../common/models');
const logging_1 = require('../logging');
const HttpsAgent = require('agentkeepalive').HttpsAgent;
const EventEmitter = require('events').EventEmitter;
const WebSocket = require('ws');
const coinbaseLog = logging_1.default('tribeca:gateway:coinbase-api');
const keepaliveAgent = new HttpsAgent();
exports.PublicClient = function(apiURI) {
  const self = this;
  console.log('starting coinbase public client, apiURI = ', apiURI);
  self.apiURI = apiURI || 'https://api.exchange.coinbase.com';
};
exports.PublicClient.prototype = new function() {
  const prototype = this;
  prototype.addHeaders = function(obj, additional) {
    obj.headers = obj.headers || {};
    return _.assign(obj.headers, {
      'User-Agent': 'coinbase-node-client',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }, additional);
  };
  prototype.makeRelativeURI = function(parts) {
    return '/' + parts.join('/');
  };
  prototype.makeAbsoluteURI = function(relativeURI) {
    const self = this;
    return self.apiURI + relativeURI;
  };
  prototype.makeRequestCallback = function(callback) {
    return function(err, response, data) {
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }
      callback(err, response, data);
    };
  };
  prototype.request = function(method, uriParts, opts, callback) {
    const self = this;
    opts = opts || {};
    if (!callback && (opts instanceof Function)) {
      callback = opts;
      opts = {};
    }
    _.assign(opts, {
      method: method.toUpperCase(),
      uri: self.makeAbsoluteURI(self.makeRelativeURI(uriParts)),
      json: true,
    });
    self.addHeaders(opts);
    opts.agent = keepaliveAgent;
    request(opts, self.makeRequestCallback(callback));
  };
  _.forEach([ 'get', 'post', 'put', 'delete' ], function(method) {
    prototype[method] = _.partial(prototype.request, method);
  });
  prototype.getProducts = function(callback) {
    const self = this;
    return prototype.get.call(self, [ 'products' ], callback);
  };
  prototype.getProductOrderBook = function(productID, level, callback) {
    const self = this;
    if (!callback && (level instanceof Function)) {
      callback = level;
      level = null;
    }
    const opts = level && { qs: { level } };
    return prototype.get.call(self, [ 'products', productID, 'book' ], opts, callback);
  };
  prototype.getProductTicker = function(productID, callback) {
    const self = this;
    return prototype.get.call(self, [ 'products', productID, 'ticker' ], callback);
  };
  prototype.getProductTrades = function(productID, callback) {
    const self = this;
    return prototype.get.call(self, [ 'products', productID, 'trades' ], callback);
  };
  prototype.getProductHistoricRates = function(productID, callback) {
    const self = this;
    return prototype.get.call(self, [ 'products', productID, 'candles' ], callback);
  };
  prototype.getProduct24HrStats = function(productID, callback) {
    const self = this;
    return prototype.get.call(self, [ 'products', productID, 'stats' ], callback);
  };
  prototype.getCurrencies = function(callback) {
    const self = this;
    return prototype.get.call(self, [ 'currencies' ], callback);
  };
  prototype.getTime = function(callback) {
    const self = this;
    return prototype.get.call(self, [ 'time' ], callback);
  };
}();
exports.AuthenticatedClient = function(key, b64secret, passphrase, apiURI) {
  const self = this;
  exports.PublicClient.call(self, apiURI);
  self.key = key;
  self.b64secret = b64secret;
  self.passphrase = passphrase;
};
util.inherits(exports.AuthenticatedClient, exports.PublicClient);
_.assign(exports.AuthenticatedClient.prototype, new function() {
  const prototype = this;
  prototype.request = function(method, uriParts, opts, callback) {
    const self = this;
    opts = opts || {};
    method = method.toUpperCase();
    if (!callback && (opts instanceof Function)) {
      callback = opts;
      opts = {};
    }
    const relativeURI = self.makeRelativeURI(uriParts);
    _.assign(opts, {
      method,
      uri: self.makeAbsoluteURI(relativeURI),
    });
    if (opts.body && (typeof opts.body !== 'string')) {
      opts.body = JSON.stringify(opts.body);
    }
    opts.agent = keepaliveAgent;
    const timestamp = Date.now() / 1000;
    const what = timestamp + method + relativeURI + (opts.body || '');
    const key = new Buffer(self.b64secret, 'base64');
    const hmac = crypto.createHmac('sha256', key);
    const signature = hmac.update(what).digest('base64');
    self.addHeaders(opts, {
      'CB-ACCESS-KEY': self.key,
      'CB-ACCESS-SIGN': signature,
      'CB-ACCESS-TIMESTAMP': timestamp,
      'CB-ACCESS-PASSPHRASE': self.passphrase,
    });
    request(opts, self.makeRequestCallback(callback));
  };
  _.forEach([ 'get', 'post', 'put', 'delete' ], function(method) {
    prototype[method] = _.partial(prototype.request, method);
  });
  prototype.getAccounts = function(callback) {
    const self = this;
    return prototype.get.call(self, [ 'accounts' ], callback);
  };
  prototype.getAccount = function(accountID, callback) {
    const self = this;
    return prototype.get.call(self, [ 'accounts', accountID ], callback);
  };
  prototype.getAccountHistory = function(accountID, callback) {
    const self = this;
    return prototype.get.call(self, [ 'accounts', accountID, 'ledger' ], callback);
  };
  prototype.getAccountHolds = function(accountID, callback) {
    const self = this;
    return prototype.get.call(self, [ 'accounts', accountID, 'holds' ], callback);
  };
  prototype._placeOrder = function(params, callback) {
    const self = this;
    _.forEach([ 'size', 'side', 'product_id' ], function(param) {
      if (params[param] === undefined) {
        throw '`opts` must include param `' + param + '`';
      }
    });
    const opts = { body: params };
    return prototype.post.call(self, [ 'orders' ], opts, callback);
  };
  prototype.buy = function(params, callback) {
    const self = this;
    params.side = 'buy';
    return self._placeOrder(params, callback);
  };
  prototype.sell = function(params, callback) {
    const self = this;
    params.side = 'sell';
    return self._placeOrder(params, callback);
  };
  prototype.cancelOrder = function(orderID, callback) {
    const self = this;
    return prototype.delete.call(self, [ 'orders', orderID ], callback);
  };
  prototype.cancelAllOrders = function(callback) {
    const self = this;
    return prototype.delete.call(self, [ 'orders' ], callback);
  };
  prototype.getOrders = function(callback) {
    const self = this;
    return prototype.get.call(self, [ 'orders' ], callback);
  };
  prototype.getOrder = function(orderID, callback) {
    const self = this;
    return prototype.get.call(self, [ 'orders', orderID ], callback);
  };
  prototype.getFills = function(callback) {
    const self = this;
    return prototype.get.call(self, [ 'fills' ], callback);
  };
  prototype.deposit = function(params, callback) {
    const self = this;
    params.type = 'deposit';
    return self._transferFunds(params, callback);
  };
  prototype.withdraw = function(params, callback) {
    const self = this;
    params.type = 'withdraw';
    return self._transferFunds(params, callback);
  };
  prototype._transferFunds = function(params, callback) {
    const self = this;
    _.forEach([ 'type', 'amount', 'coinbase_account_id' ], function(param) {
      if (params[param] === undefined) {
        throw '`opts` must include param `' + param + '`';
      }
    });
    const opts = { body: params };
    return prototype.post.call(self, [ 'transfers' ], opts, callback);
  };
}());
exports.OrderBook = function(productID, websocketURI, restURI, timeProvider) {
  const self = this;
  EventEmitter.call(self);
  self.productID = productID || 'BTC-USD';
  self.websocketURI = websocketURI || 'wss://ws-feed.exchange.coinbase.com';
  self.restURI = restURI;
  self.state = self.STATES.closed;
  self.fail_count = 0;
  self.timeProvider = timeProvider;
  self.connect();
};
util.inherits(exports.OrderBook, EventEmitter);
_.assign(exports.OrderBook.prototype, new function() {
  const prototype = this;
  prototype.STATES = {
    closed: 'closed',
    open: 'open',
    syncing: 'syncing',
    processing: 'processing',
    error: 'error',
  };
  prototype.clear_book = function() {
    const self = this;
    self.queue = [];
    self.book = {
      sequence: -1,
      bids: {},
      asks: {},
    };
  };
  prototype.connect = function() {
    coinbaseLog.info('Starting connect');
    const self = this;
    if (self.socket) {
      self.socket.close();
    }
    self.clear_book();
    self.socket = new WebSocket(self.websocketURI);
    self.socket.on('message', self.onMessage.bind(self));
    self.socket.on('open', self.onOpen.bind(self));
    self.socket.on('close', self.onClose.bind(self));
  };
  prototype.disconnect = function() {
    const self = this;
    if (!self.socket) {
      throw 'Could not disconnect (not connected)';
    }
    self.socket.close();
    self.onClose();
  };
  prototype.changeState = function(stateName) {
    const self = this;
    const newState = self.STATES[stateName];
    if (newState === undefined) {
      throw 'Unrecognized state: ' + stateName;
    }
    const oldState = self.state;
    self.state = newState;
    if (self.fail_count > 3) { throw 'Tried to reconnect 4 times. Giving up.'; }
    if (self.state === self.STATES.error || self.state === self.STATES.closed) {
      self.fail_count += 1;
      self.socket.close();
      setTimeout(() => self.connect(), 5000);
    } else if (self.state === self.STATES.processing) {
      self.fail_count = 0;
    }
    const sc = { old: oldState, new: newState };
    coinbaseLog.info('statechange: ', sc);
    self.emit('statechange', sc);
  };
  prototype.onOpen = function() {
    const self = this;
    self.changeState(self.STATES.open);
    self.sync();
  };
  prototype.onClose = function() {
    const self = this;
    self.changeState(self.STATES.closed);
  };
  prototype.onMessage = function(datastr) {
    const self = this;
    const t = self.timeProvider.utcNow();
    const data = JSON.parse(datastr);
    if (self.state !== self.STATES.processing) {
      self.queue.push(data);
    } else {
      self.processMessage(data, t);
    }
  };
  prototype.sync = function() {
    const self = this;
    self.changeState(self.STATES.syncing);
    const subscribeMessage = {
      type: 'subscribe',
      product_id: self.productID,
    };
    self.socket.send(JSON.stringify(subscribeMessage));
    self.loadSnapshot();
  };
  prototype.loadSnapshot = function(snapshotData) {
    const self = this;
    const load = function(data) {
      let i,
        bid,
        ask;
      const convertSnapshotArray = function(array) {
        return { price: array[0], size: array[1], id: array[2] };
      };
      for (i = 0; data.bids && i < data.bids.length; i++) {
        bid = convertSnapshotArray(data.bids[i]);
        self.book.bids[bid.id] = bid;
      }

      for (i = 0; data.asks && i < data.asks.length; i++) {
        ask = convertSnapshotArray(data.asks[i]);
        self.book.asks[ask.id] = ask;
      }

      self.book.sequence = data.sequence;
      self.changeState(self.STATES.processing);
      _.forEach(self.queue, self.processMessage.bind(self));
      self.queue = [];
    };
    request({
      url: self.restURI + '/products/' + self.productID + '/book?level=3',
      headers: { 'User-Agent': 'coinbase-node-client' },
    }, function(err, response, body) {
      if (err) {
        self.changeState(self.STATES.error);
        coinbaseLog.error(err, 'error: Failed to load snapshot');
      } else if (response.statusCode !== 200) {
        self.changeState(self.STATES.error);
        coinbaseLog.error('Failed to load snapshot', response.statusCode);
      } else {
        load(JSON.parse(body));
      }
    });
  };
  prototype.processMessage = function(message, t) {
    const self = this;
    if (message.sequence <= self.book.sequence) {
      self.emit('ignored', message);
      return;
    }
    if (message.sequence != self.book.sequence + 1) {
      self.changeState(self.STATES.error);
      coinbaseLog.warn('Received message out of order, expected', self.book.sequence, 'but got', message.sequence);
    }
    self.book.sequence = message.sequence;
    self.emit(message.type, new Models.Timestamped(message, t));
  };
}());
// # sourceMappingURL=coinbase-api.js.map
