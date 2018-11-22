'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
let Prefixes;
(function(Prefixes) {
  Prefixes.SUBSCRIBE = 'u';
  Prefixes.SNAPSHOT = 'n';
  Prefixes.MESSAGE = 'm';
})(Prefixes || (Prefixes = {}));
class Publisher {
  constructor(topic, _io, snapshot, _log) {
    this.topic = topic;
    this._io = _io;
    this._log = _log;
    this._snapshot = null;
    this.publish = msg => this._io.emit(Prefixes.MESSAGE + '-' + this.topic, msg);
    this.registerSnapshot = generator => {
      if (this._snapshot === null) {
        this._snapshot = generator;
      } else {
        throw new Error('already registered snapshot generator for topic ' + this.topic);
      }
      return this;
    };
    this.registerSnapshot(snapshot || null);
    const onConnection = s => {
      this._log('socket', s.id, 'connected for Publisher', topic);
      s.on('disconnect', () => {
        this._log('socket', s.id, 'disconnected for Publisher', topic);
      });
      s.on(Prefixes.SUBSCRIBE + '-' + topic, () => {
        if (this._snapshot !== null) {
          const snapshot = this._snapshot();
          this._log('socket', s.id, 'asking for snapshot on topic', topic);
          s.emit(Prefixes.SNAPSHOT + '-' + topic, snapshot);
        }
      });
    };
    this._io.on('connection', onConnection);
    Object.keys(this._io.sockets.connected).forEach(s => {
      onConnection(this._io.sockets.connected[s]);
    });
  }
}
exports.Publisher = Publisher;
class NullPublisher {
  constructor() {
    this.publish = msg => { };
    this.registerSnapshot = generator => this;
  }
}
exports.NullPublisher = NullPublisher;
class Subscriber {
  constructor(topic, io, _log) {
    this.topic = topic;
    this._log = _log;
    this._incrementalHandler = null;
    this._snapshotHandler = null;
    this._disconnectHandler = null;
    this._connectHandler = null;
    this.onConnect = () => {
      this._log('connect to', this.topic);
      if (this._connectHandler !== null) {
        this._connectHandler();
      }
      this._socket.emit(Prefixes.SUBSCRIBE + '-' + this.topic);
    };
    this.onDisconnect = () => {
      this._log('disconnected from', this.topic);
      if (this._disconnectHandler !== null) { this._disconnectHandler(); }
    };
    this.onIncremental = m => {
      if (this._incrementalHandler !== null) { this._incrementalHandler(m); }
    };
    this.onSnapshot = msgs => {
      this._log('handling snapshot for', this.topic, 'nMsgs:', msgs.length);
      if (this._snapshotHandler !== null) { this._snapshotHandler(msgs); }
    };
    this.disconnect = () => {
      this._log('forcing disconnection from ', this.topic);
      this._socket.off('connect', this.onConnect);
      this._socket.off('disconnect', this.onDisconnect);
      this._socket.off(Prefixes.MESSAGE + '-' + this.topic, this.onIncremental);
      this._socket.off(Prefixes.SNAPSHOT + '-' + this.topic, this.onSnapshot);
    };
    this.registerSubscriber = (incrementalHandler, snapshotHandler) => {
      if (this._incrementalHandler === null) {
        this._incrementalHandler = incrementalHandler;
      } else {
        throw new Error('already registered incremental handler for topic ' + this.topic);
      }
      if (this._snapshotHandler === null) {
        this._snapshotHandler = snapshotHandler;
      } else {
        throw new Error('already registered snapshot handler for topic ' + this.topic);
      }
      return this;
    };
    this.registerDisconnectedHandler = handler => {
      if (this._disconnectHandler === null) {
        this._disconnectHandler = handler;
      } else {
        throw new Error('already registered disconnect handler for topic ' + this.topic);
      }
      return this;
    };
    this.registerConnectHandler = handler => {
      if (this._connectHandler === null) {
        this._connectHandler = handler;
      } else {
        throw new Error('already registered connect handler for topic ' + this.topic);
      }
      return this;
    };
    this._socket = io;
    this._log('creating subscriber to', this.topic, '; connected?', this.connected);
    if (this.connected) { this.onConnect(); }
    this._socket.on('connect', this.onConnect)
      .on('disconnect', this.onDisconnect)
      .on(Prefixes.MESSAGE + '-' + topic, this.onIncremental)
      .on(Prefixes.SNAPSHOT + '-' + topic, this.onSnapshot);
  }
  get connected() {
    return this._socket.connected;
  }
}
exports.Subscriber = Subscriber;
class Fire {
  constructor(topic, io, _log) {
    this.topic = topic;
    this.fire = msg => {
      this._socket.emit(Prefixes.MESSAGE + '-' + this.topic, msg);
    };
    this._socket = io;
    this._socket.on('connect', () => _log('Fire connected to', this.topic))
      .on('disconnect', () => _log('Fire disconnected to', this.topic));
  }
}
exports.Fire = Fire;
class NullReceiver {
  constructor() {
    this.registerReceiver = handler => { };
  }
}
exports.NullReceiver = NullReceiver;
class Receiver {
  constructor(topic, io, _log) {
    this.topic = topic;
    this._log = _log;
    this._handler = null;
    this.registerReceiver = handler => {
      if (this._handler === null) {
        this._handler = handler;
      } else {
        throw new Error('already registered receive handler for topic ' + this.topic);
      }
    };
    const onConnection = s => {
      this._log('socket', s.id, 'connected for Receiver', topic);
      s.on(Prefixes.MESSAGE + '-' + this.topic, msg => {
        if (this._handler !== null) { this._handler(msg); }
      });
      s.on('error', e => {
        _log('error in Receiver', e.stack, e.message);
      });
    };
    io.on('connection', onConnection);
    Object.keys(io.sockets.connected).forEach(s => {
      onConnection(io.sockets.connected[s]);
    });
  }
}
exports.Receiver = Receiver;
class Topics {
}
Topics.FairValue = 'fv';
Topics.Quote = 'q';
Topics.ActiveSubscription = 'a';
Topics.ActiveChange = 'ac';
Topics.MarketData = 'md';
Topics.QuotingParametersChange = 'qp-sub';
Topics.SafetySettings = 'ss';
Topics.Product = 'p';
Topics.OrderStatusReports = 'osr';
Topics.ProductAdvertisement = 'pa';
Topics.Position = 'pos';
Topics.ExchangeConnectivity = 'ec';
Topics.SubmitNewOrder = 'sno';
Topics.CancelOrder = 'cxl';
Topics.MarketTrade = 'mt';
Topics.Trades = 't';
Topics.Message = 'msg';
Topics.ExternalValuation = 'ev';
Topics.QuoteStatus = 'qs';
Topics.TargetBasePosition = 'tbp';
Topics.TradeSafetyValue = 'tsv';
Topics.CancelAllOrders = 'cao';
exports.Topics = Topics;
// # sourceMappingURL=messaging.js.map
