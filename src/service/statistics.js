'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const Utils = require('./utils');
const moment = require('moment');
const logging_1 = require('./logging');
class EwmaStatisticCalculator {
  constructor(_alpha) {
    this._alpha = _alpha;
    this.latest = null;
  }
  initialize(seedData) {
    for (let i = 0; i < seedData.length; i++) { this.addNewValue(seedData[i]); }
  }
  addNewValue(value) {
    this.latest = computeEwma(value, this.latest, this._alpha);
    return this.latest;
  }
}
exports.EwmaStatisticCalculator = EwmaStatisticCalculator;
function computeEwma(newValue, previous, alpha) {
  if (previous !== null) {
    return alpha * newValue + (1 - alpha) * previous;
  }
  return newValue;
}
exports.computeEwma = computeEwma;
class EmptyEWMACalculator {
  constructor() {
    this.latest = null;
    this.Updated = new Utils.Evt();
  }
}
exports.EmptyEWMACalculator = EmptyEWMACalculator;
class ObservableEWMACalculator {
  constructor(_timeProvider, _fv, _alpha) {
    this._timeProvider = _timeProvider;
    this._fv = _fv;
    this._alpha = _alpha;
    this._log = logging_1.default('ewma');
    this.onTick = () => {
      const fv = this._fv.latestFairValue;
      if (fv === null) {
        this._log.info('Unable to compute EMWA value');
        return;
      }
      const value = computeEwma(fv.price, this._latest, this._alpha);
      this.setLatest(value);
    };
    this._latest = null;
    this.setLatest = v => {
      if (Math.abs(v - this._latest) > 1e-3) {
        this._latest = v;
        this.Updated.trigger();
        this._log.info('New EMWA value', this._latest);
      }
    };
    this.Updated = new Utils.Evt();
    this._alpha = _alpha || 0.095;
    _timeProvider.setInterval(this.onTick, moment.duration(1, 'minutes'));
    this.onTick();
  }
  get latest() { return this._latest; }
}
exports.ObservableEWMACalculator = ObservableEWMACalculator;
// # sourceMappingURL=statistics.js.map
