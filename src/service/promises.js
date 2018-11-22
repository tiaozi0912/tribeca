'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
function timeout(ms, promise) {
  return new Promise(function(resolve, reject) {
    promise.then(resolve);
    setTimeout(function() {
      reject(new Error('Timeout after ' + ms + ' ms'));
    }, ms);
  });
}
exports.timeout = timeout;
function delay(ms) {
  return new Promise(function(resolve, reject) {
    setTimeout(resolve, ms);
  });
}
exports.delay = delay;
// # sourceMappingURL=promises.js.map
