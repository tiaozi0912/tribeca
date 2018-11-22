'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const _ = require('lodash');
const Models = require('../common/models');
class MessagesPubisher {
  constructor(_timeProvider, _persister, initMsgs, _wrapped) {
    this._timeProvider = _timeProvider;
    this._persister = _persister;
    this._wrapped = _wrapped;
    this._storedMessages = [];
    this.publish = text => {
      const message = new Models.Message(text, this._timeProvider.utcNow());
      this._wrapped.publish(message);
      this._persister.persist(message);
      this._storedMessages.push(message);
    };
    _.forEach(initMsgs, m => this._storedMessages.push(m));
    _wrapped.registerSnapshot(() => _.takeRight(this._storedMessages, 50));
  }
}
exports.MessagesPubisher = MessagesPubisher;
// # sourceMappingURL=messages.js.map
