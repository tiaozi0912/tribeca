'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const StyleHelpers = require('./helpers');
const Models = require('../../common/models');
class MidMarketQuoteStyle {
  constructor() {
    this.Mode = Models.QuotingMode.Mid;
    this.GenerateQuote = input => {
      const width = input.params.width;
      const size = input.params.size;
      const bidPx = Math.max(input.fv.price - width, 0);
      const askPx = input.fv.price + width;
      return new StyleHelpers.GeneratedQuote(bidPx, size, askPx, size);
    };
  }
}
exports.MidMarketQuoteStyle = MidMarketQuoteStyle;
// # sourceMappingURL=mid-market.js.map
