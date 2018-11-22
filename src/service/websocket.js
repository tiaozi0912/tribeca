'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const ws = require('ws');
const Models = require('../common/models');
const logging_1 = require('./logging');
class WebSocket {
  constructor(_url, _reconnectInterval = 5000, _onData = null, _onConnected = null, _onDisconnected = null) {
    this._url = _url;
    this._reconnectInterval = _reconnectInterval;
    this._onData = _onData;
    this._onConnected = _onConnected;
    this._onDisconnected = _onDisconnected;
    this._ws = null;
    this.connect = () => {
      if (this._ws !== null) { return; }
      try {
        this.createSocket();
      } catch (error) {
        this._log.error('unhandled exception creating websocket!', error);
        throw (error);
      }
    };
    this._failureCount = 0;
    this.createSocket = () => {
      this._ws = new ws(this._url);
      this._ws = this._ws
        .on('open', () => {
          try {
            this._failureCount = 0;
            this._log.info('connected');
            this._onConnected();
          } catch (e) {
            this._log.error('error handling websocket open!');
          }
        })
        .on('message', data => {
          try {
            const t = new Date();
            this._onData(new Models.Timestamped(data, t));
          } catch (e) {
            this._log.error('error handling websocket message!', { data, error: e });
          }
        })
        .on('close', (code, message) => {
          try {
            this._log.info('disconnected', { code, message });
            this._onDisconnected();
            this.closeAndReconnect();
          } catch (e) {
            this._log.error('error handling websocket disconnect!', { code, message });
          }
        })
        .on('error', err => {
          this._log.info('socket error', err);
          this._onDisconnected();
          this.closeAndReconnect();
        });
    };
    this.closeAndReconnect = () => {
      if (this._ws === null) { return; }
      this._failureCount += 1;
      this._ws.close();
      this._ws = null;
      const interval = this._failureCount == 1 ? 10 : this._reconnectInterval;
      this._log.info(`will try a reconnect in ${interval}ms, failed ${this._failureCount} times`);
      setTimeout(() => {
        this._log.info('reconnection begun');
        this.connect();
      }, interval);
    };
    this.send = (data, callback) => {
      if (this._ws !== null) {
        this._ws.send(data, e => {
          if (!e && callback) { callback(); } else if (e) { this._log.error(e, 'error during websocket send!'); }
        });
      } else {
        this._log.warn(data, 'cannot send because socket is not connected!');
      }
    };
    this._log = logging_1.default(`ws:${this._url}`);
    this._onData = this._onData || (_ => { });
    this._onConnected = this._onConnected || (() => { });
    this._onDisconnected = this._onDisconnected || (() => { });
  }
  get isConnected() { return this._ws.readyState === ws.OPEN; }
}
exports.default = WebSocket;
// # sourceMappingURL=websocket.js.map
