'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const StyleHelpers = require('./helpers');
const Models = require('../../common/models');
class DepthQuoteStyle {
  constructor() {
    this.Mode = Models.QuotingMode.Depth;
    this.GenerateQuote = input => {
      const depth = input.params.width;
      const size = input.params.size;
      let bidPx = input.market.bids[0].price;
      let bidDepth = 0;
      for (const b of input.market.bids) {
        bidDepth += b.size;
        if (bidDepth >= depth) {
          break;
        } else {
          bidPx = b.price;
        }
      }
      let askPx = input.market.asks[0].price;
      let askDepth = 0;
      for (const a of input.market.asks) {
        askDepth += a.size;
        if (askDepth >= depth) {
          break;
        } else {
          askPx = a.price;
        }
      }
      return new StyleHelpers.GeneratedQuote(bidPx, size, askPx, size);
    };
  }
}
exports.DepthQuoteStyle = DepthQuoteStyle;

// # sourceMappingURL=depth.js.map
