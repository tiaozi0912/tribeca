'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const Models = require('../common/models');
const Utils = require('./utils');
const logging_1 = require('./logging');
class ActiveRepository {
  constructor(startQuoting, _exchangeConnectivity, _pub, _rec) {
    this._exchangeConnectivity = _exchangeConnectivity;
    this._pub = _pub;
    this._rec = _rec;
    this._log = logging_1.default('tribeca:active');
    this.NewParameters = new Utils.Evt();
    this._savedQuotingMode = false;
    this._latest = false;
    this.handleNewQuotingModeChangeRequest = v => {
      if (v !== this._savedQuotingMode) {
        this._savedQuotingMode = v;
        this._log.info('Changed saved quoting state', this._savedQuotingMode);
        this.updateParameters();
      }
      this._pub.publish(this.latest);
    };
    this.reevaluateQuotingMode = () => {
      if (this._exchangeConnectivity.connectStatus !== Models.ConnectivityStatus.Connected) { return false; }
      return this._savedQuotingMode;
    };
    this.updateParameters = () => {
      const newMode = this.reevaluateQuotingMode();
      if (newMode !== this._latest) {
        this._latest = newMode;
        this._log.info('Changed quoting mode to', this.latest);
        this.NewParameters.trigger();
        this._pub.publish(this.latest);
      }
    };
    this._log.info('Starting saved quoting state: ', startQuoting);
    this._savedQuotingMode = startQuoting;
    _pub.registerSnapshot(() => [ this.latest ]);
    _rec.registerReceiver(this.handleNewQuotingModeChangeRequest);
    _exchangeConnectivity.ConnectChanged.on(() => this.updateParameters());
  }
  get savedQuotingMode() {
    return this._savedQuotingMode;
  }
  get latest() {
    return this._latest;
  }
}
exports.ActiveRepository = ActiveRepository;

// # sourceMappingURL=active-state.js.map
