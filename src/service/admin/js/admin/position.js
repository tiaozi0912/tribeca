'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const angular = require('angular');
const Models = require('../common/models');
const Messaging = require('../common/messaging');
const PositionController = ($scope, $log, subscriberFactory, product) => {
  const toAmt = a => a.toFixed(product.fixed + 1);
  const clearPosition = () => {
    $scope.baseCurrency = null;
    $scope.quoteCurrency = null;
    $scope.basePosition = null;
    $scope.quotePosition = null;
    $scope.baseHeldPosition = null;
    $scope.quoteHeldPosition = null;
    $scope.value = null;
    $scope.quoteValue = null;
  };
  const updatePosition = position => {
    $scope.baseCurrency = Models.Currency[position.pair.base];
    $scope.quoteCurrency = Models.Currency[position.pair.quote];
    $scope.basePosition = toAmt(position.baseAmount);
    $scope.quotePosition = toAmt(position.quoteAmount);
    $scope.baseHeldPosition = toAmt(position.baseHeldAmount);
    $scope.quoteHeldPosition = toAmt(position.quoteHeldAmount);
    $scope.value = toAmt(position.value);
    $scope.quoteValue = toAmt(position.quoteValue);
  };
  const positionSubscriber = subscriberFactory.getSubscriber($scope, Messaging.Topics.Position)
    .registerDisconnectedHandler(clearPosition)
    .registerSubscriber(updatePosition, us => us.forEach(updatePosition));
  $scope.$on('$destroy', () => {
    positionSubscriber.disconnect();
    $log.info('destroy position grid');
  });
  $log.info('started position grid');
};
exports.positionDirective = 'positionDirective';
angular
  .module(exports.positionDirective, [ 'ui.bootstrap', 'sharedDirectives' ])
  .directive('positionGrid', () => {
    return {
      restrict: 'E',
      replace: true,
      transclude: false,
      templateUrl: 'positions.html',
      controller: PositionController,
      scope: {
        exch: '=',
      },
    };
  });
// # sourceMappingURL=position.js.map
