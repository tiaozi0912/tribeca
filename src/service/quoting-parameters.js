'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const _ = require('lodash');
const Utils = require('./utils');
const logging_1 = require('./logging');
class Repository {
  constructor(_name, _validator, _paramsEqual, defaultParameter, _rec, _pub) {
    this._name = _name;
    this._validator = _validator;
    this._paramsEqual = _paramsEqual;
    this._rec = _rec;
    this._pub = _pub;
    this._log = logging_1.default('tribeca:' + this._name);
    this.NewParameters = new Utils.Evt();
    this.updateParameters = newParams => {
      if (this._validator(newParams) && this._paramsEqual(newParams, this._latest)) {
        this._latest = newParams;
        this._log.info('Changed parameters', this.latest);
        this.NewParameters.trigger();
      }
      this._pub.publish(this.latest);
    };
    this._log.info('Starting parameter:', defaultParameter);
    _pub.registerSnapshot(() => [ this.latest ]);
    _rec.registerReceiver(this.updateParameters);
    this._latest = defaultParameter;
  }
  get latest() {
    return this._latest;
  }
}
class QuotingParametersRepository extends Repository {
  constructor(pub, rec, initParam) {
    super('qpr', p => p.size > 0 || p.width > 0, (a, b) => !_.isEqual(a, b), initParam, rec, pub);
  }
}
exports.QuotingParametersRepository = QuotingParametersRepository;
// # sourceMappingURL=quoting-parameters.js.map
