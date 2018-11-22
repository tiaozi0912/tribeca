'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const Models = require('../common/models');
const Utils = require('./utils');
const _ = require('lodash');
const moment = require('moment');
const logging_1 = require('./logging');
class PositionManager {
  constructor(_details, _timeProvider, _persister, _fvAgent, _data, _shortEwma, _longEwma) {
    this._details = _details;
    this._timeProvider = _timeProvider;
    this._persister = _persister;
    this._fvAgent = _fvAgent;
    this._data = _data;
    this._shortEwma = _shortEwma;
    this._longEwma = _longEwma;
    this._log = logging_1.default('rfv');
    this.NewTargetPosition = new Utils.Evt();
    this._latest = null;
    this.updateEwmaValues = () => {
      const fv = this._fvAgent.latestFairValue;
      if (fv === null) { return; }
      const rfv = new Models.RegularFairValue(this._timeProvider.utcNow(), fv.price);
      const newShort = this._shortEwma.addNewValue(fv.price);
      const newLong = this._longEwma.addNewValue(fv.price);
      const minTick = this._details.minTickIncrement;
      const factor = 1 / minTick;
      let newTargetPosition = ((newShort * factor / newLong) - factor) * 5;
      if (newTargetPosition > 1) { newTargetPosition = 1; }
      if (newTargetPosition < -1) { newTargetPosition = -1; }
      if (Math.abs(newTargetPosition - this._latest) > minTick) {
        this._latest = newTargetPosition;
        this.NewTargetPosition.trigger();
      }
      this._log.info(`recalculated regular fair value, short: ${newShort} long: ${newLong}, target: ${this._latest}, currentFv: ${fv.price}`);
      this._data.push(rfv);
      this._persister.persist(rfv);
    };
    const lastTime = (this._data !== null && _.some(_data)) ? _.last(this._data).time : null;
    this._timer = new RegularTimer(_timeProvider, this.updateEwmaValues, moment.duration(1, 'hours'), moment(lastTime));
  }
  get latestTargetPosition() {
    return this._latest;
  }
}
exports.PositionManager = PositionManager;
class TargetBasePositionManager {
  constructor(_timeProvider, _positionManager, _params, _positionBroker, _wrapped, _persister) {
    this._timeProvider = _timeProvider;
    this._positionManager = _positionManager;
    this._params = _params;
    this._positionBroker = _positionBroker;
    this._wrapped = _wrapped;
    this._persister = _persister;
    this._log = logging_1.default('positionmanager');
    this.NewTargetPosition = new Utils.Evt();
    this._latest = null;
    this.recomputeTargetPosition = () => {
      const latestPosition = this._positionBroker.latestReport;
      const params = this._params.latest;
      if (params === null || latestPosition === null) { return; }
      let targetBasePosition = params.targetBasePosition;
      if (params.autoPositionMode === Models.AutoPositionMode.EwmaBasic) {
        targetBasePosition = ((1 + this._positionManager.latestTargetPosition) / 2.0) * latestPosition.value;
      }
      if (this._latest === null || Math.abs(this._latest.data - targetBasePosition) > 0.05) {
        this._latest = new Models.TargetBasePositionValue(targetBasePosition, this._timeProvider.utcNow());
        this.NewTargetPosition.trigger();
        this._wrapped.publish(this.latestTargetPosition);
        this._persister.persist(this.latestTargetPosition);
        this._log.info('recalculated target base position:', this.latestTargetPosition.data);
      }
    };
    _wrapped.registerSnapshot(() => [ this._latest ]);
    _positionBroker.NewReport.on(r => this.recomputeTargetPosition());
    _params.NewParameters.on(() => this.recomputeTargetPosition());
    _positionManager.NewTargetPosition.on(() => this.recomputeTargetPosition());
  }
  get latestTargetPosition() {
    return this._latest;
  }
}
exports.TargetBasePositionManager = TargetBasePositionManager;
class RegularTimer {
  constructor(_timeProvider, _action, _diffTime, lastTime) {
    this._timeProvider = _timeProvider;
    this._action = _action;
    this._diffTime = _diffTime;
    this.tick = () => {
      this._action();
    };
    this.startTicking = () => {
      this.tick();
      this._timeProvider.setInterval(this.tick, moment.duration(this._diffTime.asMilliseconds()));
    };
    if (!moment.isMoment(lastTime)) {
      this.startTicking();
    } else {
      const timeout = lastTime.add(_diffTime).diff(_timeProvider.utcNow());
      if (timeout > 0) {
        _timeProvider.setTimeout(this.startTicking, moment.duration(timeout));
      } else {
        this.startTicking();
      }
    }
  }
}
exports.RegularTimer = RegularTimer;
// # sourceMappingURL=position-management.js.map
