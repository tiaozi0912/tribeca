'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const angular = require('angular');
const moment = require('moment');
const Messaging = require('../common/messaging');
const Shared = require('./shared_directives');
class MessageViewModel {
  constructor(message) {
    this.time = (moment.isMoment(message.time) ? message.time : moment(message.time));
    this.text = message.text;
  }
}
const MessagesController = ($scope, $log, subscriberFactory) => {
  $scope.messages = [];
  $scope.messageOptions = {
    data: 'messages',
    showGroupPanel: false,
    rowHeight: 20,
    headerRowHeight: 0,
    showHeader: false,
    groupsCollapsedByDefault: true,
    enableColumnResize: true,
    sortInfo: { fields: [ 'time' ], directions: [ 'desc' ] },
    columnDefs: [
      { width: 120, field: 'time', displayName: 't', cellFilter: 'momentFullDate' },
      { width: '*', field: 'text', displayName: 'text' },
    ],
  };
  const addNewMessage = u => {
    $scope.messages.push(new MessageViewModel(u));
  };
  const sub = subscriberFactory.getSubscriber($scope, Messaging.Topics.Message)
    .registerSubscriber(addNewMessage, x => x.forEach(addNewMessage))
    .registerConnectHandler(() => $scope.messages.length = 0);
  $scope.$on('$destroy', () => {
    sub.disconnect();
    $log.info('destroy message grid');
  });
  $log.info('started message grid');
};
exports.messagesDirective = 'messagesDirective';
angular
  .module(exports.messagesDirective, [ 'ui.bootstrap', 'ui.grid', Shared.sharedDirectives ])
  .directive('messagesGrid', () => {
    const template = '<div><div style="height: 75px" class="table table-striped table-hover table-condensed" ui-grid="messageOptions"></div></div>';
    return {
      restrict: 'E',
      replace: true,
      transclude: false,
      template,
      controller: MessagesController,
    };
  });
// # sourceMappingURL=messages.js.map
