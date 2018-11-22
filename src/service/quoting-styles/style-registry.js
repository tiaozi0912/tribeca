'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const _ = require('lodash');
class NullQuoteGenerator {
  constructor() {
    this.Mode = null;
    this.GenerateQuote = input => {
      return null;
    };
  }
}
class QuotingStyleRegistry {
  constructor(modules) {
    this.Get = mode => {
      const mod = this._mapping[mode];
      if (typeof mod === 'undefined') { return QuotingStyleRegistry.NullQuoteGenerator; }
      return mod;
    };
    this._mapping = _.sortBy(modules, s => s.Mode);
  }
}
QuotingStyleRegistry.NullQuoteGenerator = new NullQuoteGenerator();
exports.QuotingStyleRegistry = QuotingStyleRegistry;
// # sourceMappingURL=style-registry.js.map
