'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const bunyan = require('bunyan');
const _ = require('lodash');
function log(name) {
  const isRunFromMocha = process.argv.length >= 2 && _.includes(process.argv[1], 'mocha');
  if (isRunFromMocha) {
    return bunyan.createLogger({ name, stream: process.stdout, level: bunyan.FATAL });
  }
  let level = 'info';
  if (_.includes(process.argv, 'debug')) {
    level = 'debug';
  }
  return bunyan.createLogger({
    name,
    streams: [{ level, stream: process.stdout }],
  });
}
exports.default = log;
// # sourceMappingURL=logging.js.map
