'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const Models = require('../common/models');
const _ = require('lodash');
const request = require('request');
require('events').EventEmitter.prototype._maxListeners = 100;
exports.date = () => new Date();
function fastDiff(x, y) {
  return x.getTime() - y.getTime();
}
exports.fastDiff = fastDiff;
function timeOrDefault(x, timeProvider) {
  if (x === null) { return timeProvider.utcNow(); }
  if (typeof x !== 'undefined' && typeof x.time !== 'undefined') { return x.time; }
  return timeProvider.utcNow();
}
exports.timeOrDefault = timeOrDefault;
class Evt {
  constructor() {
    this._singleCallback = null;
    this._multiCallback = new Array();
    this.on = handler => {
      if (this._singleCallback) {
        this._multiCallback = [ this._singleCallback, handler ];
        this._singleCallback = null;
      } else if (this._multiCallback.length > 0) {
        this._multiCallback.push(handler);
      } else {
        this._singleCallback = handler;
      }
    };
    this.off = handler => {
      if (this._multiCallback.length > 0) { this._multiCallback = _.pull(this._multiCallback, handler); }
      if (this._singleCallback === handler) { this._singleCallback = null; }
    };
    this.trigger = data => {
      if (this._singleCallback !== null) {
        this._singleCallback(data);
      } else {
        const len = this._multiCallback.length;
        for (let i = 0; i < len; i++) { this._multiCallback[i](data); }
      }
    };
  }
}
exports.Evt = Evt;
function roundSide(x, minTick, side) {
  switch (side) {
    case Models.Side.Bid: return roundDown(x, minTick);
    case Models.Side.Ask: return roundUp(x, minTick);
    default: return roundNearest(x, minTick);
  }
}
exports.roundSide = roundSide;
function roundNearest(x, minTick) {
  const up = roundUp(x, minTick);
  const down = roundDown(x, minTick);
  return (Math.abs(x - down) > Math.abs(up - x)) ? up : down;
}
exports.roundNearest = roundNearest;
function roundUp(x, minTick) {
  return Math.ceil(x / minTick) * minTick;
}
exports.roundUp = roundUp;
function roundDown(x, minTick) {
  return Math.floor(x / minTick) * minTick;
}
exports.roundDown = roundDown;
class RealTimeProvider {
  constructor() {
    this.utcNow = () => new Date();
    this.setTimeout = (action, time) => setTimeout(action, time.asMilliseconds());
    this.setImmediate = action => setImmediate(action);
    this.setInterval = (action, time) => setInterval(action, time.asMilliseconds());
  }
}
exports.RealTimeProvider = RealTimeProvider;
class ImmediateActionScheduler {
  constructor(_timeProvider) {
    this._timeProvider = _timeProvider;
    this._shouldSchedule = true;
    this.schedule = action => {
      if (this._shouldSchedule) {
        this._shouldSchedule = false;
        this._timeProvider.setImmediate(() => {
          action();
          this._shouldSchedule = true;
        });
      }
    };
  }
}
exports.ImmediateActionScheduler = ImmediateActionScheduler;
function getJSON(url, qs) {
  return new Promise((resolve, reject) => {
    request({ url, qs }, (err, resp, body) => {
      if (err) {
        reject(err);
      } else {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      }
    });
  });
}
exports.getJSON = getJSON;
// # sourceMappingURL=utils.js.map
