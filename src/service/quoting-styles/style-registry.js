'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const _ = require('lodash');
const debug = require('debug')('tribeca:style-registry');
class NullQuoteGenerator {
  constructor() {
    this.Mode = null;
    this.GenerateQuote = input => {
      return null;
    };
  }
}
class QuotingStyleRegistry {
  /**
   * @param {Array} modules Array of StyleHelpers.QuoteStyle
   */
  constructor(modules) {
    this._mapping = _.sortBy(modules, s => s.Mode);

    /**
     * @param {Object} mode Models.QuotingMode object
     * @return {Object} style StyleHelpers.QuoteStyle
     */
    this.Get = mode => {
      const mod = this._mapping[mode];
      // debug('quotingMode:', mode);
      // debug('quotingStyle mode:', mod.Mode);

      if (typeof mod === 'undefined') { return QuotingStyleRegistry.NullQuoteGenerator; }
      return mod;
    };
  }
}
QuotingStyleRegistry.NullQuoteGenerator = new NullQuoteGenerator();
exports.QuotingStyleRegistry = QuotingStyleRegistry;
// # sourceMappingURL=style-registry.js.map
