'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
class GeneratedQuote {
  constructor(bidPx, bidSz, askPx, askSz) {
    this.bidPx = bidPx;
    this.bidSz = bidSz;
    this.askPx = askPx;
    this.askSz = askSz;
  }
}
exports.GeneratedQuote = GeneratedQuote;
class QuoteInput {
  constructor(market, fv, params, minTickIncrement, minSizeIncrement = 0.01) {
    this.market = market;
    this.fv = fv;
    this.params = params;
    this.minTickIncrement = minTickIncrement;
    this.minSizeIncrement = minSizeIncrement;
  }
}
exports.QuoteInput = QuoteInput;
// # sourceMappingURL=helpers.js.map
