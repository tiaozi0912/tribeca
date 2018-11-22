'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const angular = require('angular');
const Messaging = require('../common/messaging');
const Models = require('../common/models');
const io = require('socket.io-client');
const mypopover = ($compile, $templateCache) => {
  const getTemplate = (contentType, template_url) => {
    let template = '';
    switch (contentType) {
      case 'user':
        template = $templateCache.get(template_url);
        break;
    }
    return template;
  };
  return {
    restrict: 'A',
    link: (scope, element, attrs) => {
      const popOverContent = $compile('<div>' + getTemplate('user', attrs.popoverTemplate) + '</div>')(scope);
      const options = {
        content: popOverContent,
        placement: attrs.dataPlacement,
        html: true,
        date: scope.date,
      };
      jQuery(element).popover(options).click(e => {
        e.preventDefault();
      });
    },
  };
};
const bindOnce = () => {
  return {
    scope: true,
    link: $scope => {
      setTimeout(() => {
        $scope.$destroy();
      }, 0);
    },
  };
};
class FireFactory {
  constructor(socket, $log) {
    this.socket = socket;
    this.$log = $log;
    this.getFire = topic => {
      return new Messaging.Fire(topic, this.socket, this.$log.info);
    };
  }
}
exports.FireFactory = FireFactory;
class SubscriberFactory {
  constructor(socket, $log) {
    this.socket = socket;
    this.$log = $log;
    this.getSubscriber = (scope, topic) => {
      return new EvalAsyncSubscriber(scope, topic, this.socket, this.$log.info);
    };
  }
}
exports.SubscriberFactory = SubscriberFactory;
class EvalAsyncSubscriber {
  constructor(_scope, topic, io, log) {
    this._scope = _scope;
    this.registerSubscriber = (incrementalHandler, snapshotHandler) => {
      return this._wrapped.registerSubscriber(x => this._scope.$evalAsync(() => incrementalHandler(x)), xs => this._scope.$evalAsync(() => snapshotHandler(xs)));
    };
    this.registerDisconnectedHandler = handler => {
      return this._wrapped.registerDisconnectedHandler(() => this._scope.$evalAsync(handler));
    };
    this.registerConnectHandler = handler => {
      return this._wrapped.registerConnectHandler(() => this._scope.$evalAsync(handler));
    };
    this.disconnect = () => this._wrapped.disconnect();
    this._wrapped = new Messaging.Subscriber(topic, io, log);
  }
  get connected() { return this._wrapped.connected; }
}
exports.EvalAsyncSubscriber = EvalAsyncSubscriber;
function fastDiff(a, b) {
  return a.valueOf() - b.valueOf();
}
exports.fastDiff = fastDiff;
exports.sharedDirectives = 'sharedDirectives';
angular.module(exports.sharedDirectives, [ 'ui.bootstrap' ])
  .directive('mypopover', mypopover)
  .directive('bindOnce', bindOnce)
  .factory('socket', () => io())
  .factory('product', function() { return { advert: new Models.ProductAdvertisement(null, null, 'none', 0.01) }; })
  .service('subscriberFactory', SubscriberFactory)
  .service('fireFactory', FireFactory)
  .filter('veryShortDate', () => Models.veryShortDate)
  .filter('momentFullDate', () => Models.toUtcFormattedTime)
  .filter('momentShortDate', () => Models.toShortTimeString);
// # sourceMappingURL=shared_directives.js.map
