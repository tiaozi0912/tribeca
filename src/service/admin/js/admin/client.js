'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
global.jQuery = require('jquery');
const angular = require('angular');
const ui_bootstrap = require('angular-ui-bootstrap');
const ngGrid = require('../ui-grid.min');
const bootstrap = require('../bootstrap.min');
const Models = require('../common/models');
const OrderList = require('./orderlist');
const Trades = require('./trades');
const Messaging = require('../common/messaging');
const Shared = require('./shared_directives');
const Pair = require('./pair');
const MarketQuoting = require('./market-quoting');
const MarketTrades = require('./market-trades');
const Messages = require('./messages');
const Position = require('./position');
const Tbp = require('./target-base-position');
const TradeSafety = require('./trade-safety');
class DisplayOrder {
  constructor(fireFactory, _log) {
    this._log = _log;
    this.submit = () => {
      const msg = new Models.OrderRequestFromUI(this.side, this.price, this.quantity, this.timeInForce, this.orderType);
      this._log.info('submitting order', msg);
      this._fire.fire(msg);
    };
    this.availableSides = DisplayOrder.getNames(Models.Side);
    this.availableTifs = DisplayOrder.getNames(Models.TimeInForce);
    this.availableOrderTypes = DisplayOrder.getNames(Models.OrderType);
    this._fire = fireFactory.getFire(Messaging.Topics.SubmitNewOrder);
  }
  static getNames(enumObject) {
    const names = [];
    for (const mem in enumObject) {
      if (!enumObject.hasOwnProperty(mem)) { continue; }
      if (parseInt(mem, 10) >= 0) {
        names.push(enumObject[mem]);
      }
    }
    return names;
  }
}
const uiCtrl = ($scope, $timeout, $log, subscriberFactory, fireFactory, product) => {
  const cancelAllFirer = fireFactory.getFire(Messaging.Topics.CancelAllOrders);
  $scope.cancelAllOrders = () => cancelAllFirer.fire(new Models.CancelAllOrdersRequest());
  $scope.order = new DisplayOrder(fireFactory, $log);
  $scope.pair = null;
  const onAdvert = pa => {
    $log.info('advert', pa);
    $scope.connected = true;
    $scope.env = pa.environment;
    $scope.pair_name = Models.Currency[pa.pair.base] + '/' + Models.Currency[pa.pair.quote];
    $scope.exch_name = Models.Exchange[pa.exchange];
    $scope.pair = new Pair.DisplayPair($scope, subscriberFactory, fireFactory);
    product.advert = pa;
    product.fixed = -1 * Math.floor(Math.log10(pa.minTick));
  };
  const reset = (reason, connected) => {
    $log.info('reset', reason);
    $scope.connected = connected;
    if (connected) {
      $scope.pair_name = null;
      $scope.exch_name = null;
      if ($scope.pair !== null) { $scope.pair.dispose(); }
      $scope.pair = null;
    }
  };
  reset('startup', false);
  const sub = subscriberFactory.getSubscriber($scope, Messaging.Topics.ProductAdvertisement)
    .registerSubscriber(onAdvert, a => a.forEach(onAdvert))
    .registerConnectHandler(() => reset('connect', true))
    .registerDisconnectedHandler(() => reset('disconnect', false));
  $scope.$on('$destroy', () => {
    sub.disconnect();
    $log.info('destroy client');
  });
  $log.info('started client');
};
const requires = [ 'ui.bootstrap',
  'ui.grid',
  OrderList.orderListDirective,
  Trades.tradeListDirective,
  MarketQuoting.marketQuotingDirective,
  MarketTrades.marketTradeDirective,
  Messages.messagesDirective,
  Position.positionDirective,
  Tbp.targetBasePositionDirective,
  TradeSafety.tradeSafetyDirective,
  Shared.sharedDirectives ];
angular.module('projectApp', requires)
  .controller('uiCtrl', uiCtrl);
// # sourceMappingURL=client.js.map
