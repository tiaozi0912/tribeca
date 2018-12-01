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
const mongodb = require('mongodb');
const moment = require('moment');
const logging_1 = require('./logging');
function loadDb(config) {
  return mongodb.MongoClient.connect(config.GetString('MongoDbUrl'));
}

exports.loadDb = loadDb;

class RepositoryPersister {
  constructor(collection, _defaultParameter, _dbName, _exchange, _pair) {
    this.collection = collection;
    this._defaultParameter = _defaultParameter;
    this._dbName = _dbName;
    this._exchange = _exchange;
    this._pair = _pair;
    this._log = logging_1.default('tribeca:exchangebroker:repopersister');
    this.loadLatest = () => __awaiter(this, void 0, void 0, function* () {
      const selector = { exchange: this._exchange, pair: this._pair };
      const docs = yield this.collection.find(selector)
        .limit(1)
        .project({ _id: 0 })
        .sort({ $natural: -1 })
        .toArray();
      if (docs.length === 0) { return this._defaultParameter; }
      const v = _.defaults(docs[0], this._defaultParameter);
      return this.converter(v);
    });
    this.persist = report => __awaiter(this, void 0, void 0, function* () {
      try {
        yield this.collection.insertOne(this.converter(report));
        this._log.info('Persisted', report);
      } catch (err) {
        this._log.error(err, 'Unable to insert', this._dbName, report);
      }
    });
    this.converter = x => {
      if (typeof x.exchange === 'undefined') { x.exchange = this._exchange; }
      if (typeof x.pair === 'undefined') { x.pair = this._pair; }
      return x;
    };
  }
}
exports.RepositoryPersister = RepositoryPersister;

class Persister {
  constructor(time, collection, _dbName, _exchange, _pair) {
    this.collection = collection;
    this._dbName = _dbName;
    this._exchange = _exchange;
    this._pair = _pair;
    this._log = logging_1.default('persister');

    this.loadAll = (limit, query) => {
      const selector = { exchange: this._exchange, pair: this._pair };
      _.assign(selector, query);
      return this.loadInternal(selector, limit);
    };
    this.loadInternal = (selector, limit) => __awaiter(this, void 0, void 0, function* () {
      let query = this.collection.find(selector, { _id: 0 });
      if (limit !== null) {
        const count = yield this.collection.count(selector);
        query = query.limit(limit);
        if (count !== 0) { query = query.skip(Math.max(count - limit, 0)); }
      }
      const loaded = _.map(yield query.toArray(), this.converter);
      this._log.info({
        selector,
        limit,
        nLoaded: loaded.length,
        dbName: this._dbName,
      }, 'load docs completed');
      return loaded;
    });
    this._persistQueue = [];
    this.persist = report => {
      this._persistQueue.push(report);
    };
    this.converter = x => {
      if (typeof x.time === 'undefined') { x.time = new Date(); }
      if (typeof x.exchange === 'undefined') { x.exchange = this._exchange; }
      if (typeof x.pair === 'undefined') { x.pair = this._pair; }
      return x;
    };
    this._log = logging_1.default('persister:' + _dbName);

    time.setInterval(() => __awaiter(this, void 0, void 0, function* () {
      if (this._persistQueue.length === 0) { return; }
      const docs = _.map(this._persistQueue, this.converter);
      try {
        const result = yield collection.insertMany(docs);
        if (result.result && result.result.ok) {
          this._persistQueue.length = 0;
        } else {
          this._log.warn('Unable to insert, retrying soon', this._dbName, this._persistQueue);
        }
      } catch (err) {
        this._log.error(err, 'Unable to insert, retrying soon', this._dbName, this._persistQueue);
      }
    }), moment.duration(10, 'seconds'));
  }
}
exports.Persister = Persister;
// # sourceMappingURL=persister.js.map
