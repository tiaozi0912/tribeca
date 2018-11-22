'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const angular = require('angular');
const Models = require('../common/models');
const moment = require('moment');
const Messaging = require('../common/messaging');
const Shared = require('./shared_directives');
class DisplayTrade {
  constructor(trade) {
    this.trade = trade;
    this.tradeId = trade.tradeId;
    this.side = trade.side === Models.Side.Ask ? 'S' : 'B';
    this.time = (moment.isMoment(trade.time) ? trade.time : moment(trade.time));
    this.price = trade.price;
    this.quantity = trade.quantity;
    this.value = trade.value;
    if (trade.liquidity === 0 || trade.liquidity === 1) {
      this.liquidity = Models.Liquidity[trade.liquidity].charAt(0);
    } else {
      this.liquidity = '?';
    }
  }
}
const TradesListController = ($scope, $log, subscriberFactory, uiGridConstants) => {
  $scope.trade_statuses = [];
  $scope.gridOptions = {
    data: 'trade_statuses',
    treeRowHeaderAlwaysVisible: false,
    primaryKey: 'tradeId',
    groupsCollapsedByDefault: true,
    enableColumnResize: true,
    sortInfo: { fields: [ 'time' ], directions: [ 'desc' ] },
    rowHeight: 20,
    headerRowHeight: 20,
    columnDefs: [
      { width: 80, field: 'time', displayName: 't', cellFilter: 'momentShortDate',
        sortingAlgorithm: Shared.fastDiff,
        sort: { direction: uiGridConstants.DESC, priority: 1 } },
      { width: 55, field: 'price', displayName: 'px' },
      { width: 50, field: 'quantity', displayName: 'qty' },
      { width: 30, field: 'side', displayName: 'side', cellClass: (grid, row, col, rowRenderIndex, colRenderIndex) => {
        if (grid.getCellValue(row, col) === 'B') {
          return 'buy';
        } else if (grid.getCellValue(row, col) === 'S') {
          return 'sell';
        }

        return 'unknown';

      } },
      { width: 30, field: 'liquidity', displayName: 'liq' },
      { width: 60, field: 'value', displayName: 'val', cellFilter: 'currency:"$":3' },
    ],
  };
  const addTrade = t => $scope.trade_statuses.push(new DisplayTrade(t));
  const sub = subscriberFactory.getSubscriber($scope, Messaging.Topics.Trades)
    .registerConnectHandler(() => $scope.trade_statuses.length = 0)
    .registerSubscriber(addTrade, trades => trades.forEach(addTrade));
  $scope.$on('$destroy', () => {
    sub.disconnect();
    $log.info('destroy trades list');
  });
  $log.info('started trades list');
};
const tradeList = () => {
  const template = '<div><div ui-grid="gridOptions" ui-grid-grouping class="table table-striped table-hover table-condensed" style="height: 553px" ></div></div>';
  return {
    template,
    restrict: 'E',
    replace: true,
    transclude: false,
    controller: TradesListController,
    scope: {
      exch: '=',
      pair: '=',
    },
  };
};
exports.tradeListDirective = 'tradeListDirective';
angular.module(exports.tradeListDirective, [ 'ui.bootstrap', 'ui.grid', 'ui.grid.grouping', Shared.sharedDirectives ])
  .directive('tradeList', tradeList);
// # sourceMappingURL=trades.js.map
