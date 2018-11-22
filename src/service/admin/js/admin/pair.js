'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const angular = require('angular');
const Models = require('../common/models');
const Messaging = require('../common/messaging');
class FormViewModel {
  constructor(defaultParameter, _sub, _fire, _submitConverter = null) {
    this._sub = _sub;
    this._fire = _fire;
    this._submitConverter = _submitConverter;
    this.pending = false;
    this.connected = false;
    this.reset = () => {
      this.display = angular.copy(this.master);
    };
    this.update = p => {
      console.log('updating parameters', p);
      this.master = angular.copy(p);
      this.display = angular.copy(p);
      this.pending = false;
    };
    this.submit = () => {
      this.pending = true;
      this._fire.fire(this._submitConverter(this.display));
    };
    if (this._submitConverter === null) { this._submitConverter = d => d; }
    _sub.registerConnectHandler(() => this.connected = true)
      .registerDisconnectedHandler(() => this.connected = false)
      .registerSubscriber(this.update, us => us.forEach(this.update));
    this.connected = _sub.connected;
    this.master = angular.copy(defaultParameter);
    this.display = angular.copy(defaultParameter);
  }
}
class QuotingButtonViewModel extends FormViewModel {
  constructor(sub, fire) {
    super(false, sub, fire, d => !d);
    this.getClass = () => {
      if (this.pending) { return 'btn btn-warning'; }
      if (this.display) { return 'btn btn-success'; }
      return 'btn btn-danger';
    };
  }
}
class DisplayQuotingParameters extends FormViewModel {
  constructor(sub, fire) {
    super(new Models.QuotingParameters(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null), sub, fire);
    this.availableQuotingModes = [];
    this.availableFvModels = [];
    this.availableAutoPositionModes = [];
    this.availableQuotingModes = DisplayQuotingParameters.getMapping(Models.QuotingMode);
    this.availableFvModels = DisplayQuotingParameters.getMapping(Models.FairValueModel);
    this.availableAutoPositionModes = DisplayQuotingParameters.getMapping(Models.AutoPositionMode);
  }
  static getMapping(enumObject) {
    const names = [];
    for (const mem in enumObject) {
      if (!enumObject.hasOwnProperty(mem)) { continue; }
      const val = parseInt(mem, 10);
      if (val >= 0) {
        names.push({ str: enumObject[mem], val });
      }
    }
    return names;
  }
}
class DisplayPair {
  constructor(scope, subscriberFactory, fireFactory) {
    this.scope = scope;
    this.connected = false;
    this.connectedToExchange = false;
    this.connectedToServer = false;
    this.connectionMessage = null;
    this._subscribers = [];
    this.dispose = () => {
      console.log('dispose client');
      this._subscribers.forEach(s => s.disconnect());
    };
    this.updateParameters = p => {
      this.quotingParameters.update(p);
    };
    const setStatus = () => {
      this.connected = (this.connectedToExchange && this.connectedToServer);
      console.log('connection status changed: ', this.connected, 'connectedToExchange', this.connectedToExchange, 'connectedToServer', this.connectedToServer);
      if (this.connected) {
        this.connectionMessage = null;
        return;
      }
      if (!this.connectedToExchange) {
        this.connectionMessage = 'Disconnected from exchange';
      }
      if (!this.connectedToServer) {
        this.connectionMessage = 'Disconnected from tribeca';
      }
    };
    const setExchangeStatus = cs => {
      this.connectedToExchange = cs == Models.ConnectivityStatus.Connected;
      setStatus();
    };
    const setServerStatus = cs => {
      this.connectedToServer = cs;
      setStatus();
    };
    const connectivitySubscriber = subscriberFactory.getSubscriber(scope, Messaging.Topics.ExchangeConnectivity)
      .registerSubscriber(setExchangeStatus, cs => cs.forEach(setExchangeStatus))
      .registerDisconnectedHandler(() => setServerStatus(false))
      .registerConnectHandler(() => setServerStatus(true));
    this.connectedToServer = connectivitySubscriber.connected;
    setStatus();
    this._subscribers.push(connectivitySubscriber);
    const activeSub = subscriberFactory.getSubscriber(scope, Messaging.Topics.ActiveChange);
    this.active = new QuotingButtonViewModel(activeSub, fireFactory.getFire(Messaging.Topics.ActiveChange));
    this._subscribers.push(activeSub);
    const qpSub = subscriberFactory.getSubscriber(scope, Messaging.Topics.QuotingParametersChange);
    this.quotingParameters = new DisplayQuotingParameters(qpSub, fireFactory.getFire(Messaging.Topics.QuotingParametersChange));
    this._subscribers.push(qpSub);
  }
}
exports.DisplayPair = DisplayPair;
// # sourceMappingURL=pair.js.map
